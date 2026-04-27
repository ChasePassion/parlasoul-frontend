"use client";

import { createRealtimeSession, deleteRealtimeSession, getRealtimeIceConfig } from "@/lib/api";
import { logger, Module, RealtimeEvent } from "@/lib/logger";
import { mapMicStartError } from "@/lib/voice/mic-errors";

export interface RealtimeSubtitleState {
  userRaw: string;
  assistantRaw: string;
  assistantTranslated: string;
}

export type RealtimeConversationEvent =
  | {
      type: "conversation.turn.created";
      chat_id: string;
      user_turn_id: string;
      user_candidate_id: string;
      assistant_turn_id: string;
      assistant_candidate_id: string;
    }
  | {
      type: "conversation.turn.updated";
      chat_id: string;
      assistant_turn_id: string;
      assistant_candidate_id: string;
      is_final: boolean;
    }
  | {
      type: "conversation.turn.failed";
      chat_id: string;
      assistant_turn_id: string;
      assistant_candidate_id: string;
      code: string;
      message?: string;
    };

export interface RealtimeVoiceSessionClientHandlers {
  onConnected?: (
    sessionId: string,
    source?: "sdp_answer_applied" | "session_created_event",
  ) => void;
  onDisconnected?: () => void;
  onUserSpeakingChange?: (speaking: boolean) => void;
  onBotSpeakingChange?: (speaking: boolean) => void;
  onSubtitleDelta?: (channel: string, text: string) => void;
  onSubtitleFinal?: (channel: string, text: string) => void;
  onConversationEvent?: (event: RealtimeConversationEvent) => void;
  onError?: (error: Error) => void;
}

export class RealtimeVoiceSessionClient {
  private pc: RTCPeerConnection | null = null;
  private dc: RTCDataChannel | null = null;
  private localStream: MediaStream | null = null;
  private localAudioTrack: MediaStreamTrack | null = null;
  private micAudioContext: AudioContext | null = null;
  private micAnalyser: AnalyserNode | null = null;
  private micSource: MediaStreamAudioSourceNode | null = null;
  private audioSender: RTCRtpSender | null = null;
  private remoteStream: MediaStream | null = null;
  private audioElement: HTMLAudioElement | null = null;
  private sessionId: string | null = null;
  private handlers: RealtimeVoiceSessionClientHandlers;
  /** Monotonic counter bumped by disconnect(). connect() checks this after each
   *  await to bail out early when an external disconnect() raced with it. */
  private _isMicCaptureEnabled = true;
  private disconnectGeneration = 0;

  constructor(handlers: RealtimeVoiceSessionClientHandlers = {}) {
    this.handlers = handlers;
  }

  attachAudioElement(element: HTMLAudioElement | null): void {
    this.audioElement = element;
    if (element && this.remoteStream) {
      element.srcObject = this.remoteStream;
      element.muted = false;
      element.volume = 1;
      element.setAttribute("playsinline", "true");
      element.autoplay = true;
      void element.play().catch(() => {});
    }
  }

  getMicAnalyserNode(): AnalyserNode | null {
    return this._isMicCaptureEnabled ? this.micAnalyser : null;
  }

  async connect(params: {
    chatId: string;
    characterId: string;
    translationEnabled: boolean;
    signal?: AbortSignal;
  }): Promise<void> {
    logger.info(
      Module.REALTIME,
      RealtimeEvent.CONNECT_STARTED,
      "Realtime WebRTC connect started",
      {
        chat_id: params.chatId,
        character_id: params.characterId,
        has_existing_session: Boolean(this.sessionId),
      },
    );
    await this.disconnect({ emitDisconnected: false });
    const generation = this.disconnectGeneration;
    const bailIfStale = () => {
      if (this.disconnectGeneration !== generation) {
        throw new Error("DISCONNECTED_DURING_CONNECT");
      }
      throwIfAborted(params.signal);
    };
    try {
      const realtimeConfig = await getRealtimeIceConfig({
        signal: params.signal,
      });
      bailIfStale();

      try {
        this.localStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            channelCount: 1,
          },
        });
        this.localAudioTrack = this.localStream.getAudioTracks()[0] ?? null;
        this.setupMicAnalyser(this.localStream);
      } catch (micError) {
        throw new Error(mapMicStartError(micError));
      }
      bailIfStale();

      this.remoteStream = new MediaStream();
      this.pc = new RTCPeerConnection({
        iceServers: realtimeConfig.ice_servers,
      });
      this.dc = this.pc.createDataChannel("realtime-control", { ordered: true });

      this.dc.onmessage = (event) => {
        try {
          const payload = JSON.parse(
            typeof event.data === "string"
              ? event.data
              : new TextDecoder().decode(event.data),
          ) as {
            type: string;
            channel?: string;
            text?: string;
            message?: string;
            reason?: string;
            session_id?: string;
          };
          this.handleServerEvent(payload);
        } catch (error) {
          this.handlers.onError?.(
            error instanceof Error ? error : new Error("Invalid realtime event"),
          );
        }
      };

      this.pc.ontrack = (event) => {
        if (!this.remoteStream) {
          this.remoteStream = new MediaStream();
        }
        if (event.track.kind === "audio") {
          this.remoteStream.addTrack(event.track);
        } else if (event.streams[0]) {
          event.streams[0].getAudioTracks().forEach((track) => {
            this.remoteStream?.addTrack(track);
          });
        }
        if (this.audioElement) {
          this.audioElement.srcObject = this.remoteStream;
          this.audioElement.muted = false;
          this.audioElement.volume = 1;
          this.audioElement.setAttribute("playsinline", "true");
          this.audioElement.autoplay = true;
          void this.audioElement.play().catch(() => {});
        }
      };

      this.pc.onconnectionstatechange = () => {
        const state = this.pc?.connectionState;
        if (state === "failed") {
          const shouldReport = Boolean(this.sessionId);
          void this.disconnect();
          if (shouldReport) {
            this.handlers.onError?.(new Error("实时通话连接已中断"));
          }
        }
      };

      this.localStream.getTracks().forEach((track) => {
        const sender = this.pc?.addTrack(track, this.localStream as MediaStream) ?? null;
        if (track.kind === "audio") {
          this.audioSender = sender;
        }
      });

      const offer = await this.pc.createOffer();
      bailIfStale();
      await this.pc.setLocalDescription(offer);
      bailIfStale();
      await this.waitForIceGatheringComplete(params.signal);
      bailIfStale();

      const negotiated = await createRealtimeSession({
        chat_id: params.chatId,
        character_id: params.characterId,
        sdp: {
          type: this.pc.localDescription?.type || "offer",
          sdp: this.pc.localDescription?.sdp || "",
        },
      }, {
        signal: params.signal,
      });
      bailIfStale();

      this.sessionId = negotiated.session_id;
      await this.pc.setRemoteDescription(
        new RTCSessionDescription({
          type: negotiated.sdp.type as RTCSdpType,
          sdp: negotiated.sdp.sdp,
        }),
      );
      bailIfStale();

      this.sendEvent({
        type: "session.update",
        translation_enabled: params.translationEnabled,
      });

      logger.info(
        Module.REALTIME,
        RealtimeEvent.CONNECT_SIGNALLED,
        "Realtime connect advanced after SDP answer",
        {
          session_id: negotiated.session_id,
          source: "sdp_answer_applied",
        },
      );
      this.handlers.onConnected?.(negotiated.session_id, "sdp_answer_applied");
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "DISCONNECTED_DURING_CONNECT"
      ) {
        // Already cleaned up by the external disconnect() — nothing to do.
        return;
      }
      await this.disconnect();
      throw error;
    }
  }

  async disconnect(options?: { emitDisconnected?: boolean }): Promise<void> {
    const emitDisconnected = options?.emitDisconnected ?? true;
    this.disconnectGeneration += 1;
    const hadLocalStream = Boolean(this.localStream);
    const hadPeerConnection = Boolean(this.pc);
    const hadDataChannel = Boolean(this.dc);

    this._isMicCaptureEnabled = true;

    // 1. Release mic tracks IMMEDIATELY so the browser drops the indicator.
    this.cleanupMicAnalyser();
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }
    this.localAudioTrack = null;

    // 2. Tear down WebRTC & audio before any network calls.
    if (this.dc) {
      this.dc.close();
      this.dc = null;
    }

    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }
    this.audioSender = null;

    if (this.audioElement) {
      this.audioElement.srcObject = null;
    }
    this.remoteStream = null;

    // 3. Delete the server session last — this is best-effort and must not
    //    block mic release (which is why it comes after track.stop).
    const sid = this.sessionId;
    this.sessionId = null;
    if (sid) {
      try {
        await deleteRealtimeSession(sid);
      } catch {
        // Session might already be gone server-side.
      }
    }

    logger.info(
      Module.REALTIME,
      RealtimeEvent.DISCONNECTED,
      "Realtime client disconnected",
      {
        session_id: sid ?? null,
        emit_disconnected: emitDisconnected,
        had_local_stream: hadLocalStream,
        had_peer_connection: hadPeerConnection,
        had_data_channel: hadDataChannel,
      },
    );
    if (emitDisconnected) {
      this.handlers.onDisconnected?.();
    }
  }

  updateSession(params: {
    translationEnabled?: boolean;
  }): void {
    this.sendEvent({
      type: "session.update",
      translation_enabled: params.translationEnabled,
    });
  }

  async setMicCaptureEnabled(enabled: boolean): Promise<void> {
    logger.info(
      Module.REALTIME,
      RealtimeEvent.MIC_CAPTURE_REQUESTED,
      "Realtime mic capture toggle requested",
      {
        session_id: this.sessionId ?? null,
        enabled,
      },
    );

    const audioTrack = this.localAudioTrack;
    if (!audioTrack) {
      logger.warn(
        Module.REALTIME,
        RealtimeEvent.MIC_CAPTURE_FAILED,
        "Realtime mic capture toggle skipped because local audio track is missing",
        {
          session_id: this.sessionId ?? null,
          enabled,
        },
      );
      return;
    }

    try {
      this._isMicCaptureEnabled = enabled;
      audioTrack.enabled = enabled;

      if (!this.audioSender && this.pc) {
        this.audioSender =
          this.pc
            .getSenders()
            .find((sender) => sender.track?.kind === "audio") ?? null;
      }

      if (this.audioSender) {
        if (enabled) {
          if (this.audioSender.track !== audioTrack) {
            await this.audioSender.replaceTrack(audioTrack);
          }
          this.sendEvent({ type: "input_audio_buffer.unmute" });
        } else {
          await this.audioSender.replaceTrack(null);
          this.sendEvent({ type: "input_audio_buffer.mute" });
        }
      }

      logger.info(
        Module.REALTIME,
        RealtimeEvent.MIC_CAPTURE_APPLIED,
        "Realtime mic capture toggle applied",
        {
          session_id: this.sessionId ?? null,
          enabled,
          sender_track_present: Boolean(this.audioSender?.track),
        },
      );
    } catch (error) {
      this._isMicCaptureEnabled = true;
      audioTrack.enabled = true;
      logger.fromError(Module.REALTIME, error, RealtimeEvent.MIC_CAPTURE_FAILED, {
        session_id: this.sessionId ?? null,
        enabled,
      });
      throw error;
    }
  }

  cancelResponse(): void {
    this.sendEvent({
      type: "response.cancel",
    });
  }

  private sendEvent(payload: Record<string, unknown>): void {
    if (this.dc && this.dc.readyState === "open") {
      this.dc.send(JSON.stringify(payload));
    }
  }

  private setupMicAnalyser(stream: MediaStream): void {
    this.cleanupMicAnalyser();

    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioContext = new AudioCtx();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.78;

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      this.micAudioContext = audioContext;
      this.micAnalyser = analyser;
      this.micSource = source;

      if (audioContext.state === "suspended") {
        void audioContext.resume().catch(() => {});
      }
    } catch {
      this.cleanupMicAnalyser();
    }
  }

  private cleanupMicAnalyser(): void {
    if (this.micSource) {
      try {
        this.micSource.disconnect();
      } catch {
        // no-op
      }
      this.micSource = null;
    }

    if (this.micAudioContext) {
      void this.micAudioContext.close().catch(() => {});
      this.micAudioContext = null;
    }

    this.micAnalyser = null;
  }

  private handleServerEvent(event: Record<string, unknown>): void {
    if (event.type === "session.created") {
      const sessionId =
        typeof event.session_id === "string" ? event.session_id : this.sessionId || "";
      logger.info(
        Module.REALTIME,
        RealtimeEvent.CONNECT_SIGNALLED,
        "Realtime connect advanced after session.created",
        {
          session_id: sessionId || null,
          source: "session_created_event",
        },
      );
      this.handlers.onConnected?.(sessionId, "session_created_event");
      return;
    }
    if (event.type === "input_audio_buffer.speech_started") {
      this.handlers.onUserSpeakingChange?.(true);
      return;
    }
    if (event.type === "input_audio_buffer.speech_stopped") {
      this.handlers.onUserSpeakingChange?.(false);
      return;
    }
    if (event.type === "response.started") {
      this.handlers.onBotSpeakingChange?.(true);
      return;
    }
    if (event.type === "response.interrupted" || event.type === "response.done") {
      this.handlers.onBotSpeakingChange?.(false);
      return;
    }
    if (
      event.type === "subtitle.delta" &&
      typeof event.channel === "string" &&
      typeof event.text === "string"
    ) {
      this.handlers.onSubtitleDelta?.(event.channel, event.text);
      return;
    }
    if (
      event.type === "subtitle.final" &&
      typeof event.channel === "string" &&
      typeof event.text === "string"
    ) {
      this.handlers.onSubtitleFinal?.(event.channel, event.text);
      return;
    }
    if (
      event.type === "conversation.turn.created" ||
      event.type === "conversation.turn.updated" ||
      event.type === "conversation.turn.failed"
    ) {
      this.handlers.onConversationEvent?.(event as RealtimeConversationEvent);
      return;
    }
    if (event.type === "error") {
      this.handlers.onError?.(
        new Error(typeof event.message === "string" ? event.message : "Realtime error"),
      );
    }
  }

  private async waitForIceGatheringComplete(signal?: AbortSignal): Promise<void> {
    if (!this.pc || this.pc.iceGatheringState === "complete") {
      return;
    }

    await new Promise<void>((resolve) => {
      const cleanup = () => {
        this.pc?.removeEventListener("icegatheringstatechange", handleStateChange);
        signal?.removeEventListener("abort", handleAbort);
      };
      const handleStateChange = () => {
        if (this.pc?.iceGatheringState === "complete") {
          cleanup();
          resolve();
        }
      };
      const handleAbort = () => {
        cleanup();
        resolve();
      };
      this.pc?.addEventListener("icegatheringstatechange", handleStateChange);
      signal?.addEventListener("abort", handleAbort, { once: true });
    });
  }
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new DOMException("The operation was aborted.", "AbortError");
  }
}
