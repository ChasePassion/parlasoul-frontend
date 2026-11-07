"use client";

import {
  createRealtimeSession,
  deleteRealtimeSession,
  getRealtimeIceConfig,
  type RealtimeIceConfigResponse,
} from "@/lib/api";
import { logger, Module, RealtimeEvent } from "@/lib/logger";
import { mapMicStartError } from "@/lib/voice/mic-errors";

const ICE_GATHERING_TIMEOUT_MS = 2500;
/**
 * Local barge-in gating: once the microphone clearly carries speech while the
 * bot is talking, cut the remote element immediately instead of waiting for the
 * server round-trip. The server remains the source of truth for cancelling the
 * response; if it decides the sound was a backchannel, playback is restored.
 */
const LOCAL_BARGE_RMS_THRESHOLD = 0.015;
const LOCAL_BARGE_SUSTAIN_SAMPLES = 3;
const LOCAL_BARGE_RESTORE_SAMPLES = 15;
const REMOTE_PLAYOUT_DELAY_HINT_SECONDS = 0.05;

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
  private micLevelTimer: ReturnType<typeof setInterval> | null = null;
  private micSpeechStreak = 0;
  private micQuietStreak = 0;
  private localAudioDucked = false;
  private botSpeakingLocal = false;
  private audioSender: RTCRtpSender | null = null;
  private remoteStream: MediaStream | null = null;
  private audioElement: HTMLAudioElement | null = null;
  private sessionId: string | null = null;
  private handlers: RealtimeVoiceSessionClientHandlers;
  private _isMicCaptureEnabled = true;
  /** Monotonic counter bumped by disconnect(). connect() checks this after each
   *  await to bail out early when an external disconnect() raced with it. */
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
    getIceConfig?: (signal?: AbortSignal) => Promise<RealtimeIceConfigResponse>;
    signal?: AbortSignal;
  }): Promise<void> {
    const connectStartedAt = performance.now();
    const timings: Record<string, number | boolean | string | null> = {};
    const markDuration = (key: string, startedAt: number) => {
      timings[key] = Math.round(performance.now() - startedAt);
    };
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
      const configStartedAt = performance.now();
      const realtimeConfigPromise = (
        params.getIceConfig
          ? params.getIceConfig(params.signal)
          : getRealtimeIceConfig({ signal: params.signal })
      ).then((config) => {
        markDuration("config_fetch_ms", configStartedAt);
        timings.ice_server_count = config.ice_servers.length;
        timings.credential_ttl_seconds = config.credential_ttl_seconds;
        return config;
      });

      const mediaStartedAt = performance.now();
      const localStreamPromise = this.acquireLocalStream().then((stream) => {
        markDuration("media_acquire_ms", mediaStartedAt);
        return stream;
      });

      const [configResult, mediaResult] = await Promise.allSettled([
        realtimeConfigPromise,
        localStreamPromise,
      ]);
      const stopResolvedLocalStream = () => {
        if (mediaResult.status === "fulfilled") {
          mediaResult.value.getTracks().forEach((track) => track.stop());
        }
      };
      if (this.disconnectGeneration !== generation || params.signal?.aborted) {
        stopResolvedLocalStream();
      }
      bailIfStale();
      if (configResult.status === "rejected") {
        stopResolvedLocalStream();
        throw configResult.reason;
      }
      if (mediaResult.status === "rejected") {
        throw mediaResult.reason;
      }
      const realtimeConfig = configResult.value;
      this.localStream = mediaResult.value;
      this.localAudioTrack = this.localStream.getAudioTracks()[0] ?? null;
      this.setupMicAnalyser(this.localStream);
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
          const receiver = event.receiver as RTCRtpReceiver & {
            playoutDelayHint?: number;
          };
          try {
            // Ask Chrome for the shortest playout delay it can sustain; the
            // server pacer already emits perfectly spaced 20ms frames.
            receiver.playoutDelayHint = REMOTE_PLAYOUT_DELAY_HINT_SECONDS;
          } catch {
            // Unsupported property is fine; default playout latency applies.
          }
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

      const localStream = this.localStream;
      if (!localStream) {
        throw new Error("实时通话麦克风不可用");
      }
      localStream.getTracks().forEach((track) => {
        const sender = this.pc?.addTrack(track, localStream) ?? null;
        if (track.kind === "audio") {
          this.audioSender = sender;
        }
      });

      const offerStartedAt = performance.now();
      const offer = await this.pc.createOffer();
      markDuration("offer_create_ms", offerStartedAt);
      bailIfStale();
      const localDescriptionStartedAt = performance.now();
      await this.pc.setLocalDescription(offer);
      markDuration("local_description_ms", localDescriptionStartedAt);
      bailIfStale();
      const iceGathering = await this.waitForIceGatheringComplete(params.signal);
      timings.ice_wait_ms = iceGathering.elapsedMs;
      timings.ice_gathering_timed_out = iceGathering.timedOut;
      timings.ice_gathering_state = iceGathering.state;
      bailIfStale();

      const sessionPostStartedAt = performance.now();
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
      markDuration("session_post_ms", sessionPostStartedAt);
      bailIfStale();

      this.sessionId = negotiated.session_id;
      const remoteDescriptionStartedAt = performance.now();
      await this.pc.setRemoteDescription(
        new RTCSessionDescription({
          type: negotiated.sdp.type as RTCSdpType,
          sdp: negotiated.sdp.sdp,
        }),
      );
      markDuration("remote_description_ms", remoteDescriptionStartedAt);
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
          connect_total_ms: Math.round(performance.now() - connectStartedAt),
          ...timings,
        },
      );
      this.handlers.onConnected?.(negotiated.session_id, "sdp_answer_applied");
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "DISCONNECTED_DURING_CONNECT"
      ) {
        await this.disconnect({ emitDisconnected: false });
        return;
      }
      await this.disconnect();
      throw error;
    }
  }

  private async acquireLocalStream(): Promise<MediaStream> {
    try {
      return await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      });
    } catch (micError) {
      throw new Error(mapMicStartError(micError));
    }
  }

  async disconnect(options?: { emitDisconnected?: boolean }): Promise<void> {
    const emitDisconnected = options?.emitDisconnected ?? true;
    this.disconnectGeneration += 1;
    const hadLocalStream = Boolean(this.localStream);
    const hadPeerConnection = Boolean(this.pc);
    const hadDataChannel = Boolean(this.dc);

    this._isMicCaptureEnabled = true;
    this.botSpeakingLocal = false;
    this.localAudioDucked = false;
    if (this.audioElement) {
      this.audioElement.volume = 1;
    }

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
      if (!enabled) {
        // A muted microphone cannot barge in; drop any local duck.
        this.micSpeechStreak = 0;
        this.micQuietStreak = 0;
        this.restoreRemoteAudio();
      }

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
      this.startMicLevelMonitor(analyser);

      if (audioContext.state === "suspended") {
        void audioContext.resume().catch(() => {});
      }
    } catch {
      this.cleanupMicAnalyser();
    }
  }

  private cleanupMicAnalyser(): void {
    this.stopMicLevelMonitor();
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

  private startMicLevelMonitor(analyser: AnalyserNode): void {
    this.stopMicLevelMonitor();
    const buffer = new Float32Array(analyser.fftSize);
    this.micSpeechStreak = 0;
    this.micQuietStreak = 0;
    this.micLevelTimer = setInterval(() => {
      if (!this._isMicCaptureEnabled) {
        this.micSpeechStreak = 0;
        this.micQuietStreak = 0;
        return;
      }
      analyser.getFloatTimeDomainData(buffer);
      let sum = 0;
      for (let i = 0; i < buffer.length; i += 1) {
        sum += buffer[i] * buffer[i];
      }
      const rms = Math.sqrt(sum / buffer.length);
      if (rms >= LOCAL_BARGE_RMS_THRESHOLD) {
        this.micSpeechStreak += 1;
        this.micQuietStreak = 0;
      } else {
        this.micQuietStreak += 1;
        this.micSpeechStreak = 0;
      }
      if (
        this.botSpeakingLocal &&
        !this.localAudioDucked &&
        this.micSpeechStreak >= LOCAL_BARGE_SUSTAIN_SAMPLES
      ) {
        this.duckRemoteAudio();
      }
      if (this.localAudioDucked && this.micQuietStreak >= LOCAL_BARGE_RESTORE_SAMPLES) {
        this.restoreRemoteAudio();
      }
    }, 20);
  }

  private stopMicLevelMonitor(): void {
    if (this.micLevelTimer !== null) {
      clearInterval(this.micLevelTimer);
      this.micLevelTimer = null;
    }
    this.micSpeechStreak = 0;
    this.micQuietStreak = 0;
  }

  private duckRemoteAudio(): void {
    if (this.localAudioDucked) return;
    this.localAudioDucked = true;
    if (this.audioElement) {
      this.audioElement.volume = 0;
    }
    logger.info(Module.REALTIME, RealtimeEvent.LOCAL_BARGE_IN_DUCK, "Realtime local barge-in duck", {
      session_id: this.sessionId ?? null,
    });
  }

  private restoreRemoteAudio(): void {
    if (!this.localAudioDucked) return;
    this.localAudioDucked = false;
    if (this.audioElement) {
      this.audioElement.volume = 1;
    }
    logger.info(
      Module.REALTIME,
      RealtimeEvent.LOCAL_BARGE_IN_RESTORE,
      "Realtime local barge-in restore",
      { session_id: this.sessionId ?? null },
    );
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
      this.botSpeakingLocal = true;
      // A new generation may follow a locally ducked interrupt; make sure the
      // new audio is audible again.
      this.restoreRemoteAudio();
      this.handlers.onBotSpeakingChange?.(true);
      return;
    }
    if (event.type === "response.interrupted") {
      // Keep the local duck in place until the server confirms the old
      // generation's audio stopped draining.
      this.botSpeakingLocal = false;
      this.handlers.onBotSpeakingChange?.(false);
      return;
    }
    if (event.type === "response.audio_stopped") {
      this.botSpeakingLocal = false;
      this.restoreRemoteAudio();
      return;
    }
    if (event.type === "response.done") {
      this.botSpeakingLocal = false;
      this.restoreRemoteAudio();
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

  private async waitForIceGatheringComplete(signal?: AbortSignal): Promise<{
    elapsedMs: number;
    timedOut: boolean;
    state: RTCIceGatheringState | "unknown";
  }> {
    const startedAt = performance.now();
    if (!this.pc || this.pc.iceGatheringState === "complete") {
      return {
        elapsedMs: 0,
        timedOut: false,
        state: this.pc?.iceGatheringState ?? "unknown",
      };
    }

    return new Promise((resolve) => {
      let timeout: ReturnType<typeof setTimeout> | null = null;
      const finish = (timedOut: boolean) => {
        cleanup();
        resolve({
          elapsedMs: Math.round(performance.now() - startedAt),
          timedOut,
          state: this.pc?.iceGatheringState ?? "unknown",
        });
      };
      const cleanup = () => {
        this.pc?.removeEventListener("icegatheringstatechange", handleStateChange);
        signal?.removeEventListener("abort", handleAbort);
        if (timeout !== null) {
          clearTimeout(timeout);
          timeout = null;
        }
      };
      const handleStateChange = () => {
        if (this.pc?.iceGatheringState === "complete") {
          finish(false);
        }
      };
      const handleAbort = () => {
        finish(false);
      };
      this.pc?.addEventListener("icegatheringstatechange", handleStateChange);
      signal?.addEventListener("abort", handleAbort, { once: true });
      timeout = setTimeout(() => {
        logger.warn(
          Module.REALTIME,
          RealtimeEvent.CONNECT_TIMEOUT,
          "ICE gathering timed out, proceeding with available candidates",
          {
            ice_gathering_state: this.pc?.iceGatheringState ?? "unknown",
            timeout_ms: ICE_GATHERING_TIMEOUT_MS,
          },
        );
        finish(true);
      }, ICE_GATHERING_TIMEOUT_MS);
    });
  }
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new DOMException("The operation was aborted.", "AbortError");
  }
}
