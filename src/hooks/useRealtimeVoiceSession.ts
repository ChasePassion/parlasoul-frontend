"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  RealtimeVoiceSessionClient,
  type RealtimeConversationEvent,
  type RealtimeSubtitleState,
} from "@/lib/realtime/realtime-voice-session-client";
import { logger, Module, RealtimeEvent } from "@/lib/logger";
import {
  getMicPermissionState,
  type MicStartErrorCode,
} from "@/lib/voice/mic-errors";

const emptySubtitles: RealtimeSubtitleState = {
  userRaw: "",
  assistantRaw: "",
  assistantTranslated: "",
};

type MicPermissionAction = "request" | "settings" | null;

export function useRealtimeVoiceSession(options: {
  chatId: string;
  characterId: string | null;
  translationEnabled: boolean;
  onSessionEnded?: () => Promise<void> | void;
  onConversationEvent?: (event: RealtimeConversationEvent) => Promise<void> | void;
}) {
  const clientRef = useRef<RealtimeVoiceSessionClient | null>(null);
  const startupAbortRef = useRef<AbortController | null>(null);
  const onConversationEventRef = useRef(options.onConversationEvent);
  const onSessionEndedRef = useRef(options.onSessionEnded);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isMicCaptureEnabled, setIsMicCaptureEnabled] = useState(true);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [isBotSpeaking, setIsBotSpeaking] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [micErrorCode, setMicErrorCode] = useState<MicStartErrorCode | null>(null);
  const [micPermissionAction, setMicPermissionAction] =
    useState<MicPermissionAction>(null);
  const [subtitles, setSubtitles] = useState<RealtimeSubtitleState>(emptySubtitles);

  const bindAudioElement = useCallback((element: HTMLAudioElement | null) => {
    audioRef.current = element;
    clientRef.current?.attachAudioElement(element);
  }, []);

  useEffect(() => {
    onConversationEventRef.current = options.onConversationEvent;
  }, [options.onConversationEvent]);

  useEffect(() => {
    onSessionEndedRef.current = options.onSessionEnded;
  }, [options.onSessionEnded]);

  const clearMicError = useCallback(() => {
    setMicErrorCode(null);
    setMicPermissionAction(null);
  }, []);

  const ensureClient = useCallback(() => {
    if (clientRef.current) {
      return clientRef.current;
    }

    const client = new RealtimeVoiceSessionClient({
      onConnected: (id, source) => {
        logger.info(
          Module.REALTIME,
          RealtimeEvent.CONNECT_SIGNALLED,
          "Realtime voice state advanced to connected",
          {
            session_id: id || null,
            source: source ?? "unknown",
          },
        );
        setSessionId(id || null);
        setIsConnected(true);
        setIsConnecting(false);
        setLastError(null);
        clearMicError();
      },
      onDisconnected: () => {
        setSessionId(null);
        setIsConnected(false);
        setIsConnecting(false);
        startupAbortRef.current = null;
        setIsMicCaptureEnabled(true);
        setIsUserSpeaking(false);
        setIsBotSpeaking(false);
        setSubtitles(emptySubtitles);
        setLastError(null);
        clearMicError();
      },
      onUserSpeakingChange: setIsUserSpeaking,
      onBotSpeakingChange: setIsBotSpeaking,
      onSubtitleDelta: (channel, text) => {
        setSubtitles((prev) => ({
          ...prev,
          [channelToKey(channel)]: prev[channelToKey(channel)] + text,
        }));
      },
      onSubtitleFinal: (channel, text) => {
        setSubtitles((prev) => ({
          ...prev,
          [channelToKey(channel)]: text,
        }));
      },
      onConversationEvent: (event) => {
        void onConversationEventRef.current?.(event);
      },
      onError: (error) => {
        clearMicError();
        setLastError(error.message);
      },
    });

    if (audioRef.current) {
      client.attachAudioElement(audioRef.current);
    }

    clientRef.current = client;
    return client;
  }, [clearMicError]);

  useEffect(() => {
    return () => {
      void clientRef.current?.disconnect();
      clientRef.current = null;
    };
  }, []);

  const startCall = useCallback(async () => {
    if (!options.chatId || !options.characterId || isConnecting || isConnected) return;
    const startAt = Date.now();
    logger.info(
      Module.REALTIME,
      RealtimeEvent.START_REQUESTED,
      "Realtime voice start requested",
      {
        chat_id: options.chatId,
        character_id: options.characterId,
      },
    );
    const startupController = new AbortController();
    startupAbortRef.current = startupController;
    setIsConnecting(true);
    setIsMicCaptureEnabled(true);
    setSubtitles(emptySubtitles);
    setLastError(null);
    clearMicError();
    const permissionStateBeforeStart = await getMicPermissionState();
    const client = ensureClient();
    try {
      await client.connect({
        chatId: options.chatId,
        characterId: options.characterId,
        translationEnabled: options.translationEnabled,
        signal: startupController.signal,
      });
      if (startupAbortRef.current === startupController) {
        startupAbortRef.current = null;
      }
    } catch (error) {
      if (startupAbortRef.current === startupController) {
        startupAbortRef.current = null;
      }
      setIsConnecting(false);
      setIsConnected(false);
      if (
        error instanceof Error &&
        (error.name === "AbortError" || error.message === "DISCONNECTED_DURING_CONNECT")
      ) {
        logger.warn(
          Module.REALTIME,
          RealtimeEvent.START_ABORTED,
          "Realtime voice start aborted",
          {
            elapsed_ms: Date.now() - startAt,
          },
        );
        clearMicError();
        setLastError(null);
        return;
      }
      logger.fromError(Module.REALTIME, error, RealtimeEvent.START_FAILED, {
        elapsed_ms: Date.now() - startAt,
      });
      const msg = error instanceof Error ? error.message : "实时通话连接失败";
      if (msg.startsWith("MIC_")) {
        const code = msg as MicStartErrorCode;
        if (code === "MIC_PERMISSION_DENIED") {
          const permissionStateAfterStart = await getMicPermissionState();
          setMicPermissionAction(
            resolveMicPermissionAction(
              permissionStateBeforeStart,
              permissionStateAfterStart,
            ),
          );
        } else {
          setMicPermissionAction(null);
        }
        setMicErrorCode(code);
        setLastError(null);
      } else {
        clearMicError();
        setLastError(msg);
      }
    }
  }, [
    clearMicError,
    ensureClient,
    isConnected,
    isConnecting,
    options.characterId,
    options.chatId,
    options.translationEnabled,
  ]);

  const cancelStart = useCallback(async () => {
    startupAbortRef.current?.abort();
    startupAbortRef.current = null;
    await clientRef.current?.disconnect();
  }, []);

  const endCall = useCallback(async () => {
    startupAbortRef.current?.abort();
    startupAbortRef.current = null;
    await clientRef.current?.disconnect();
    setSubtitles(emptySubtitles);
    setIsMicCaptureEnabled(true);
    clearMicError();
    await onSessionEndedRef.current?.();
  }, [clearMicError]);

  const updatePreferences = useCallback(() => {
    clientRef.current?.updateSession({
      translationEnabled: options.translationEnabled,
    });
  }, [options.translationEnabled]);

  useEffect(() => {
    if (isConnected) {
      updatePreferences();
    }
  }, [isConnected, updatePreferences]);

  const setMicCaptureEnabled = useCallback((enabled: boolean) => {
    void (async () => {
      try {
        await clientRef.current?.setMicCaptureEnabled(enabled);
        setIsMicCaptureEnabled(enabled);
        if (!enabled) {
          setIsUserSpeaking(false);
        }
      } catch (error) {
        setLastError(error instanceof Error ? error.message : "麦克风切换失败");
      }
    })();
  }, []);

  const toggleMicCapture = useCallback(() => {
    const nextEnabled = !isMicCaptureEnabled;
    setMicCaptureEnabled(nextEnabled);
  }, [isMicCaptureEnabled, setMicCaptureEnabled]);

  const interruptAssistant = useCallback(async () => {
    clientRef.current?.cancelResponse();
  }, []);

  const getMicAnalyserNode = useCallback(() => {
    return clientRef.current?.getMicAnalyserNode() ?? null;
  }, []);

  return useMemo(
    () => ({
      audioRef: bindAudioElement,
      sessionId,
      isConnecting,
      isConnected,
      isMicCaptureEnabled,
      isUserSpeaking,
      isBotSpeaking,
      subtitles,
      lastError,
      micErrorCode,
      micPermissionAction,
      clearMicError,
      startCall,
      cancelStart,
      endCall,
      setMicCaptureEnabled,
      toggleMicCapture,
      interruptAssistant,
      getMicAnalyserNode,
    }),
    [
      bindAudioElement,
      cancelStart,
      endCall,
      getMicAnalyserNode,
      interruptAssistant,
      isBotSpeaking,
      isConnected,
      isConnecting,
      isMicCaptureEnabled,
      isUserSpeaking,
      lastError,
      micErrorCode,
      micPermissionAction,
      clearMicError,
      sessionId,
      setMicCaptureEnabled,
      startCall,
      subtitles,
      toggleMicCapture,
    ],
  );
}

function resolveMicPermissionAction(
  before: PermissionState | "unsupported",
  after: PermissionState | "unsupported",
): MicPermissionAction {
  if (before === "denied") {
    return "settings";
  }

  if (after === "denied") {
    return "request";
  }

  return "request";
}

function channelToKey(channel: string): keyof RealtimeSubtitleState {
  switch (channel) {
    case "assistant_raw":
      return "assistantRaw";
    case "assistant_translated":
      return "assistantTranslated";
    case "user_raw":
    default:
      return "userRaw";
  }
}
