"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type {
  Message,
  MessageActionStatus,
} from "@/components/ChatMessage";
import type { Character } from "@/components/Sidebar";
import type { ChatResponse, ReplySuggestion } from "@/lib/api";
import type { GrowthTodaySummary, GrowthShareCard } from "@/lib/growth-types";
import {
  ApiError,
  UnauthorizedError,
  continueGeneration,
  createReplyCard,
  editUserTurnAndStreamReply,
  regenAssistantTurn,
  selectTurnCandidateWithSnapshot,
  streamChatMessage,
  type TurnsPageResponse,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { mapCharacterToSidebar } from "@/lib/character-adapter";
import { snapshotContainsTurnIds } from "@/lib/chat-turn-snapshot";
import { ERROR_MESSAGE_MAP, getErrorMessage } from "@/lib/error-map";
import { chatTurnsQueryOptions, queryKeys } from "@/lib/query";
import type { TtsPlaybackManager } from "@/lib/voice/tts-playback-manager";
import { toast } from "sonner";

interface UseChatSessionArgs {
  chatId: string;
  isAuthed: boolean;
  canSend: boolean;
  setSelectedCharacterId: (id: string | null) => void;
  ttsPlaybackManager?: TtsPlaybackManager | null;
  autoReadAloudEnabled?: boolean;
  onGrowthDailyUpdated?: (today: GrowthTodaySummary) => void;
  onGrowthDailyRefresh?: () => void;
  onGrowthShareCardReady?: (card: GrowthShareCard) => void;
}

interface UseChatSessionResult {
  chat: ChatResponse | null;
  character: Character | null;
  messages: Message[];
  isStreaming: boolean;
  isLoading: boolean;
  error: string | null;
  currentReplySuggestions: ReplySuggestion[] | null;
  clearReplySuggestions: () => void;
  characterId: string | null;
  setCurrentChatTitle: (title: string) => void;
  handleSelectCandidate: (turnId: string, candidateNo: number) => Promise<void>;
  handleRegenAssistant: (turnId: string) => Promise<void>;
  handleContinue: () => Promise<void>;
  handleEditUser: (turnId: string, newContent: string) => Promise<void>;
  handleRetryReplyCard: (message: Message) => Promise<void>;
  handleSendMessage: (content: string) => Promise<void>;
  handleRetrySend: (errorMessageId: string) => void;
  interruptAllTts: () => void;
  interruptStream: () => void;
  loadOlderMessages: () => Promise<void>;
  hasOlderMessages: boolean;
  isLoadingOlder: boolean;
  reloadChatTurns: (options?: {
    requiredTurnIds?: Array<string | null | undefined>;
  }) => Promise<void>;
}

type ReplySuggestionsByCandidateId = Record<string, ReplySuggestion[]>;

const deriveReplyCardStatus = (message: {
  replyCard?: Message["replyCard"];
  replyCardStatus?: MessageActionStatus;
}): MessageActionStatus =>
  message.replyCardStatus ?? (message.replyCard ? "ready" : "idle");

const deriveReplyCardErrorCode = (error: unknown): string => {
  if (error instanceof ApiError) {
    return error.code || `http_${error.status}`;
  }
  if (error instanceof UnauthorizedError) {
    return "unauthorized";
  }
  return "reply_card_request_failed";
};

const deriveCurrentReplySuggestions = (
  messages: Message[],
): ReplySuggestion[] | null => {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role !== "assistant") {
      continue;
    }
    return message.replySuggestions?.length ? message.replySuggestions : null;
  }
  return null;
};

const mapTurnsPageMessage = (turn: TurnsPageResponse["turns"][number]): Message => {
  const isAssistant = turn.author_type === "CHARACTER";
  const isTurnError = isAssistant && turn.state === "ERROR";
  const replyCard = turn.primary_candidate.extra?.reply_card ?? null;

  return {
    id: turn.id,
    role: turn.author_type === "USER" ? "user" : "assistant",
    content: isTurnError ? "" : turn.primary_candidate.content,
    isGreeting:
      turn.author_type === "CHARACTER" &&
      turn.is_proactive &&
      !turn.parent_turn_id,
    candidateNo: turn.primary_candidate.candidate_no,
    candidateCount: turn.candidate_count,
    inputTransform: turn.primary_candidate.extra?.input_transform ?? null,
    replyCard,
    assistantTurnId: isAssistant ? turn.id : undefined,
    assistantCandidateId: isAssistant ? turn.primary_candidate.id : undefined,
    messageStreamStatus: isAssistant
      ? isTurnError
        ? "error"
        : turn.primary_candidate.is_final
          ? "done"
          : "streaming"
      : undefined,
    errorMessage: isTurnError
      ? ERROR_MESSAGE_MAP[turn.primary_candidate.extra?.error_code ?? ""]?.message
        ?? turn.primary_candidate.extra?.error_message
        ?? "操作失败，请稍后重试"
      : undefined,
    replyCardStatus: isAssistant ? (replyCard ? "ready" : "idle") : undefined,
    replyCardErrorCode: null,
  };
};

export function useChatSession({
  chatId,
  isAuthed,
  canSend,
  setSelectedCharacterId,
  ttsPlaybackManager,
  autoReadAloudEnabled = true,
  onGrowthDailyUpdated,
  onGrowthDailyRefresh,
  onGrowthShareCardReady,
}: UseChatSessionArgs): UseChatSessionResult {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [chat, setChat] = useState<ChatResponse | null>(null);
  const [character, setCharacter] = useState<Character | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [replySuggestionsByCandidateId, setReplySuggestionsByCandidateId] =
    useState<ReplySuggestionsByCandidateId>({});

  // Pagination state for loading older messages
  const [hasOlderMessages, setHasOlderMessages] = useState(true);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const beforeTurnIdRef = useRef<string | null>(null);
  const loadOlderInFlightRef = useRef(false);

  const streamAbortRef = useRef<AbortController | null>(null);
  const tailAbortControllersRef = useRef<Set<AbortController>>(new Set());
  const requestRunIdRef = useRef(0);
  const selectCandidateInFlightRef = useRef(false);
  const replyCardRetryInFlightRef = useRef<Set<string>>(new Set());
  const characterIdRef = useRef<string | null>(null);
  const replySuggestionsByCandidateIdRef = useRef<ReplySuggestionsByCandidateId>({});
  const autoReadAloudRef = useRef(autoReadAloudEnabled);
  const messagesRef = useRef<Message[]>(messages);
  useEffect(() => {
    autoReadAloudRef.current = autoReadAloudEnabled;
  }, [autoReadAloudEnabled]);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    replySuggestionsByCandidateIdRef.current = replySuggestionsByCandidateId;
  }, [replySuggestionsByCandidateId]);

  const clearTrackedController = useCallback((controller?: AbortController) => {
    if (!controller) {
      tailAbortControllersRef.current.clear();
      streamAbortRef.current = null;
      return;
    }
    if (streamAbortRef.current === controller) {
      streamAbortRef.current = null;
    }
    tailAbortControllersRef.current.delete(controller);
  }, []);

  const beginStream = useCallback(() => {
    streamAbortRef.current?.abort();
    const controller = new AbortController();
    streamAbortRef.current = controller;
    requestRunIdRef.current += 1;
    return { controller, requestRunId: requestRunIdRef.current };
  }, []);

  const detachControllerToTail = useCallback((controller: AbortController) => {
    if (streamAbortRef.current === controller) {
      streamAbortRef.current = null;
    }
    tailAbortControllersRef.current.add(controller);
  }, []);

  const abortAllTrackedControllers = useCallback(() => {
    streamAbortRef.current?.abort();
    streamAbortRef.current = null;
    tailAbortControllersRef.current.forEach((controller) => controller.abort());
    tailAbortControllersRef.current.clear();
  }, []);

  const clearReplySuggestions = useCallback(() => {
    replySuggestionsByCandidateIdRef.current = {};
    setReplySuggestionsByCandidateId({});
    setMessages((prev) =>
      prev.map((message) =>
        message.replySuggestions
          ? {
              ...message,
              replySuggestions: null,
            }
          : message,
      ),
    );
  }, []);

  const applyReplySuggestions = useCallback(
    (assistantCandidateId: string, suggestions: ReplySuggestion[]) => {
      setReplySuggestionsByCandidateId((prev) => ({
        ...prev,
        [assistantCandidateId]: suggestions,
      }));
      setMessages((prev) =>
        prev.map((message) =>
          message.assistantCandidateId === assistantCandidateId
            ? {
                ...message,
                replySuggestions: suggestions,
              }
            : message,
        ),
      );
    },
    [],
  );

  const currentReplySuggestions = deriveCurrentReplySuggestions(messages);

  const setCurrentChatTitle = useCallback((title: string) => {
    setChat((prev) => (prev ? { ...prev, title } : prev));
  }, []);

  const shouldReloadForRequest = useCallback(
    (requestRunId: number) => requestRunId === requestRunIdRef.current,
    [],
  );

  const abortActiveTextStream = useCallback(() => {
    streamAbortRef.current?.abort();
    streamAbortRef.current = null;
  }, []);

  const applyTurnsPage = useCallback(
    (data: TurnsPageResponse) => {
      const mappedCharacter: Character = mapCharacterToSidebar(data.character);

      setChat(data.chat);
      setCharacter(mappedCharacter);
      characterIdRef.current = data.character.id;
      setSelectedCharacterId(data.character.id);

      const mappedMessages: Message[] = data.turns
        .filter(
          (turn) => turn.author_type === "USER" || turn.author_type === "CHARACTER",
        )
        .filter(
          (turn) =>
            turn.primary_candidate.is_final ||
            turn.primary_candidate.content.trim() !== "",
        )
        .map(mapTurnsPageMessage);

      setMessages((prev) => {
        const previousReplyCardErrors = new Map<string, string | null>();
        const suggestionsByCandidateId = replySuggestionsByCandidateIdRef.current;
        prev.forEach((message) => {
          if (
            message.assistantCandidateId &&
            !message.replyCard &&
            deriveReplyCardStatus(message) === "error"
          ) {
            previousReplyCardErrors.set(
              message.assistantCandidateId,
              message.replyCardErrorCode ?? null,
            );
          }
        });

        return mappedMessages.map((message) => {
          const candidateSuggestions =
            message.assistantCandidateId &&
            suggestionsByCandidateId[message.assistantCandidateId]
              ? suggestionsByCandidateId[message.assistantCandidateId]
              : null;
          const withSuggestions = candidateSuggestions
            ? {
                ...message,
                replySuggestions: candidateSuggestions,
              }
            : message;

          if (
            withSuggestions.role !== "assistant" ||
            withSuggestions.replyCard ||
            !withSuggestions.assistantCandidateId
          ) {
            return withSuggestions;
          }

          if (!previousReplyCardErrors.has(withSuggestions.assistantCandidateId)) {
            return withSuggestions;
          }

          return {
            ...withSuggestions,
            replyCardStatus: "error",
            replyCardErrorCode:
              previousReplyCardErrors.get(withSuggestions.assistantCandidateId) ?? null,
          };
        });
      });
    },
    [setSelectedCharacterId],
  );

  const reloadChatTurns = useCallback(async (options?: {
    requiredTurnIds?: Array<string | null | undefined>;
  }) => {
    if (!chatId || !isAuthed) return;

    const data: TurnsPageResponse = await queryClient.fetchQuery(
      chatTurnsQueryOptions(user?.id, chatId, { limit: 50 }),
    );

    if (
      options?.requiredTurnIds &&
      !snapshotContainsTurnIds(data.turns, options.requiredTurnIds)
    ) {
      return;
    }

    beforeTurnIdRef.current = data.next_before_turn_id ?? null;
    setHasOlderMessages(data.has_more);

    applyTurnsPage(data);
  }, [applyTurnsPage, chatId, isAuthed, queryClient, user?.id]);

  const loadOlderMessages = useCallback(async () => {
    if (!chatId || !isAuthed || isLoadingOlder || !hasOlderMessages) return;
    if (!beforeTurnIdRef.current) return;
    if (loadOlderInFlightRef.current) return;

    loadOlderInFlightRef.current = true;
    setIsLoadingOlder(true);
    try {
      const data = await queryClient.fetchQuery(
        chatTurnsQueryOptions(user?.id, chatId, {
          beforeTurnId: beforeTurnIdRef.current,
          limit: 50,
        }),
      );

      beforeTurnIdRef.current = data.next_before_turn_id ?? null;
      setHasOlderMessages(data.has_more);

      setMessages((prev) => {
        const newMessages = data.turns
          .filter(
            (turn) => turn.author_type === "USER" || turn.author_type === "CHARACTER",
          )
          .filter(
            (turn) =>
              turn.primary_candidate.is_final ||
              turn.primary_candidate.content.trim() !== "",
          )
          .map(mapTurnsPageMessage);

        const existingIds = new Set(prev.map((m) => m.id));
        const uniqueNew = newMessages.filter((m) => !existingIds.has(m.id));

        return [...uniqueNew, ...prev];
      });
    } catch (err) {
      console.error("Failed to load older messages:", err);
    } finally {
      setIsLoadingOlder(false);
      loadOlderInFlightRef.current = false;
    }
  }, [
    chatId,
    hasOlderMessages,
    isAuthed,
    isLoadingOlder,
    queryClient,
    user?.id,
  ]);

  useEffect(() => {
    async function loadChat() {
      if (!chatId || !isAuthed) return;

      abortAllTrackedControllers();
      setIsLoading(true);
      setIsStreaming(false);
      setError(null);
      setChat(null);
      setCharacter(null);
      setMessages([]);
      clearReplySuggestions();

      try {
        beforeTurnIdRef.current = null;
        loadOlderInFlightRef.current = false;
        setHasOlderMessages(true);
        setIsLoadingOlder(false);
        await reloadChatTurns();
      } catch (err) {
        console.error("Failed to load chat:", err);
        const errorMessage = getErrorMessage(err);
        setError(errorMessage);
        toast.error(errorMessage);
      } finally {
        setIsLoading(false);
      }
    }

    loadChat();

    return () => {
      abortAllTrackedControllers();
      loadOlderInFlightRef.current = false;
        setSelectedCharacterId(null);
    };
  }, [
    abortAllTrackedControllers,
    chatId,
    clearReplySuggestions,
    isAuthed,
    reloadChatTurns,
    setSelectedCharacterId,
  ]);

  const handleSelectCandidate = useCallback(
    async (turnId: string, candidateNo: number) => {
      if (isStreaming || selectCandidateInFlightRef.current) return;
      selectCandidateInFlightRef.current = true;
      try {
        abortAllTrackedControllers();
        setError(null);
        clearReplySuggestions();
        const result = await selectTurnCandidateWithSnapshot(
          turnId,
          { candidate_no: candidateNo },
          { limit: 50, include_learning_data: true },
        );
        queryClient.setQueryData(
          queryKeys.chats.turns(user?.id, chatId, {
            limit: 50,
            includeLearningData: true,
          }),
          result.snapshot,
        );
        applyTurnsPage(result.snapshot);
      } catch (err) {
        console.error("Failed to select candidate:", err);
        setError(getErrorMessage(err));
      } finally {
        selectCandidateInFlightRef.current = false;
      }
    },
    [
      abortAllTrackedControllers,
      applyTurnsPage,
      chatId,
      clearReplySuggestions,
      isStreaming,
      queryClient,
      user?.id,
    ],
  );

  const handleRetryReplyCard = useCallback(
    async (message: Message) => {
      const candidateId = message.assistantCandidateId;
      if (!candidateId || isStreaming || message.replyCard) return;
      if (replyCardRetryInFlightRef.current.has(candidateId)) return;

      replyCardRetryInFlightRef.current.add(candidateId);
      setMessages((prev) =>
        prev.map((current) =>
          current.assistantCandidateId === candidateId
            ? {
                ...current,
                replyCardStatus: "loading",
                replyCardErrorCode: null,
              }
            : current,
        ),
      );

      try {
        const data = await createReplyCard(candidateId);
        setMessages((prev) =>
          prev.map((current) =>
            current.assistantCandidateId === candidateId
              ? {
                  ...current,
                  replyCard: data.reply_card,
                  replyCardStatus: "ready",
                  replyCardErrorCode: null,
                }
              : current,
          ),
        );
      } catch (err) {
        const errorCode = deriveReplyCardErrorCode(err);
        setMessages((prev) =>
          prev.map((current) =>
            current.assistantCandidateId === candidateId
              ? {
                  ...current,
                  replyCardStatus: "error",
                  replyCardErrorCode: errorCode,
                }
              : current,
          ),
        );
        throw err;
      } finally {
        replyCardRetryInFlightRef.current.delete(candidateId);
      }
    },
    [isStreaming],
  );

  const finalizeStreamError = useCallback(
    (
      err: unknown,
      controller: AbortController,
      metaTimeoutId: ReturnType<typeof setTimeout> | null,
      setMetaTimeoutId: (id: ReturnType<typeof setTimeout> | null) => void,
      targetMessageIds: string[],
      retryContent?: string,
    ) => {
      const errorMessage = getErrorMessage(err);
      setMessages((prev) =>
        prev.map((msg) =>
          targetMessageIds.includes(msg.id)
            ? {
                ...msg,
                content: "",
                messageStreamStatus: "error" as const,
                errorMessage,
                retryContent,
              }
            : msg,
        ),
      );
      setIsStreaming(false);
      clearTrackedController(controller);
      if (metaTimeoutId) {
        clearTimeout(metaTimeoutId);
        setMetaTimeoutId(null);
      }
    },
    [setMessages, setIsStreaming, clearTrackedController],
  );

  const handleRegenAssistant = useCallback(
    async (turnId: string) => {
      if (isStreaming || character?.status === "UNPUBLISHED") return;
      let hasStreamError = false;
      let resolvedAssistantCandidateId: string | undefined;

      ttsPlaybackManager?.interruptAll();
      await ttsPlaybackManager?.ensureResumedForRealtime();

      setMessages((prev) =>
        prev.map((message) => {
          if (message.id !== turnId) return message;
          const nextCount = Math.min(10, (message.candidateCount ?? 1) + 1);
          return {
            ...message,
            content: "",
            candidateNo: nextCount,
            candidateCount: nextCount,
            replyCard: null,
            assistantCandidateId: undefined,
            messageStreamStatus: "streaming",
            replyCardStatus: "idle",
            replyCardErrorCode: null,
          };
        }),
      );
      clearReplySuggestions();

      const { controller, requestRunId } = beginStream();
      setIsStreaming(true);

      let regenMetaTimeoutId: ReturnType<typeof setTimeout> | null = null;
      let regenTimedOut = false;

      try {
        regenMetaTimeoutId = setTimeout(() => {
          regenTimedOut = true;
          controller.abort();
        }, 30_000);

        await regenAssistantTurn(turnId, {
          signal: controller.signal,
          onMeta: (meta) => {
            if (controller.signal.aborted) return;
            if (regenMetaTimeoutId) {
              clearTimeout(regenMetaTimeoutId);
              regenMetaTimeoutId = null;
            }
            resolvedAssistantCandidateId = meta.assistant_turn.candidate_id;
            setMessages((prev) =>
              prev.map((message) =>
                message.id === turnId
                  ? {
                      ...message,
                      assistantTurnId: meta.assistant_turn.id,
                      assistantCandidateId: meta.assistant_turn.candidate_id,
                    }
                  : message,
              ),
            );
          },
          onChunk: (chunk) => {
            if (controller.signal.aborted) return;
            setMessages((prev) =>
              prev.map((message) =>
                message.id === turnId
                  ? {
                      ...message,
                      content: message.content + chunk,
                      messageStreamStatus: "streaming",
                    }
                  : message,
              ),
            );
          },
          onDone: async (fullContent, assistantTurnId, assistantCandidateId) => {
            if (controller.signal.aborted) return;
            if (assistantCandidateId) {
              resolvedAssistantCandidateId = assistantCandidateId;
            }
            setMessages((prev) =>
              prev.map((message) =>
                message.id === turnId
                  ? {
                      ...message,
                      content: fullContent,
                      assistantTurnId: assistantTurnId ?? message.assistantTurnId,
                      assistantCandidateId:
                        assistantCandidateId ?? message.assistantCandidateId,
                      messageStreamStatus: "done",
                    }
                  : message,
                ),
              );
            setIsStreaming(false);
            detachControllerToTail(controller);
          },
          onReplySuggestions: (data) => {
            if (controller.signal.aborted) return;
            if (data.suggestions && data.suggestions.length > 0) {
              applyReplySuggestions(
                data.assistant_candidate_id,
                data.suggestions,
              );
            }
          },
          onReplyCardStarted: (data) => {
            if (controller.signal.aborted) return;
            setMessages((prev) =>
              prev.map((message) =>
                message.id === turnId ||
                message.assistantCandidateId === data.assistant_candidate_id
                  ? {
                      ...message,
                      replyCardStatus: "loading",
                      replyCardErrorCode: null,
                    }
                  : message,
              ),
            );
          },
          onReplyCard: (data) => {
            if (controller.signal.aborted) return;
            setMessages((prev) =>
              prev.map((message) =>
                message.id === turnId ||
                message.assistantCandidateId === data.assistant_candidate_id
                  ? {
                      ...message,
                      assistantCandidateId:
                        message.assistantCandidateId ?? data.assistant_candidate_id,
                      replyCard: data.reply_card,
                      replyCardStatus: "ready",
                      replyCardErrorCode: null,
                    }
                  : message,
              ),
            );
          },
          onReplyCardError: (data) => {
            if (controller.signal.aborted) return;
            setMessages((prev) =>
              prev.map((message) =>
                message.id === turnId ||
                message.assistantCandidateId === data.assistant_candidate_id ||
                (!message.assistantCandidateId &&
                  resolvedAssistantCandidateId === data.assistant_candidate_id &&
                  message.id === turnId)
                  ? {
                      ...message,
                      assistantCandidateId:
                        message.assistantCandidateId ?? data.assistant_candidate_id,
                      replyCardStatus: "error",
                      replyCardErrorCode: data.code,
                    }
                  : message,
              ),
            );
          },
          onTtsAudioDelta: (data) => {
            if (controller.signal.aborted) return;
            if (!autoReadAloudRef.current) return;
            ttsPlaybackManager?.feedRealtimeChunk(
              data.assistant_candidate_id,
              data.audio_b64,
              data.mime_type,
              data.seq,
            );
          },
          onTtsAudioDone: (data) => {
            if (controller.signal.aborted) return;
            ttsPlaybackManager?.finishRealtime(data.assistant_candidate_id);
          },
          onTtsError: (data) => {
            if (controller.signal.aborted) return;
            ttsPlaybackManager?.handleTtsError(data.code, data.message);
          },
          onError: async (err) => {
            if (controller.signal.aborted) return;
            if (regenMetaTimeoutId) {
              clearTimeout(regenMetaTimeoutId);
              regenMetaTimeoutId = null;
            }
            hasStreamError = true;
            const errorMessage = getErrorMessage(err);
            setMessages((prev) =>
              prev.map((message) =>
                message.id === turnId
                  ? {
                      ...message,
                      content: "",
                      messageStreamStatus: "error",
                      errorMessage,
                      replyCardStatus:
                        deriveReplyCardStatus(message) === "loading"
                          ? "idle"
                          : message.replyCardStatus,
                    }
                  : message,
              ),
              );
            setIsStreaming(false);
            clearTrackedController(controller);
          },
        });
        if (
          !controller.signal.aborted &&
          hasStreamError &&
          shouldReloadForRequest(requestRunId)
        ) {
          await reloadChatTurns({
            requiredTurnIds: [turnId],
          });
        }
      } catch (err) {
        if (regenTimedOut) {
          finalizeStreamError(
            new Error("STREAM_TIMEOUT"),
            controller,
            regenMetaTimeoutId,
            (id) => { regenMetaTimeoutId = id; },
            [turnId],
          );
        } else if (!controller.signal.aborted) {
          finalizeStreamError(
            err,
            controller,
            regenMetaTimeoutId,
            (id) => { regenMetaTimeoutId = id; },
            [turnId],
          );
        }
      } finally {
        clearTrackedController(controller);
        if (regenMetaTimeoutId) {
          clearTimeout(regenMetaTimeoutId);
          regenMetaTimeoutId = null;
        }
      }
    },
    [
      applyReplySuggestions,
      beginStream,
      character?.status,
      clearReplySuggestions,
      clearTrackedController,
      detachControllerToTail,
      finalizeStreamError,
      isStreaming,
      reloadChatTurns,
      shouldReloadForRequest,
      ttsPlaybackManager,
    ],
  );

  const handleContinue = useCallback(
    async () => {
      if (isStreaming || character?.status === "UNPUBLISHED") return;

      const lastAssistant = [...messagesRef.current].reverse().find(
        (message) => message.role === "assistant" && message.assistantTurnId,
      );
      if (!lastAssistant?.assistantTurnId) return;

      const turnId = lastAssistant.assistantTurnId;
      let hasStreamError = false;

      ttsPlaybackManager?.interruptAll();
      await ttsPlaybackManager?.ensureResumedForRealtime();

      const tempAssistantId = `assistant-continue-${crypto.randomUUID()}`;
      let resolvedAssistantMessageId = tempAssistantId;
      let resolvedAssistantCandidateId: string | undefined;

      clearReplySuggestions();

      setMessages((prev) => [
        ...prev,
        {
          id: tempAssistantId,
          role: "assistant",
          content: "",
          isTemp: true,
          messageStreamStatus: "streaming",
          replyCardStatus: "idle",
          replyCardErrorCode: null,
        },
      ]);

      const { controller, requestRunId } = beginStream();
      setIsStreaming(true);

      let continueMetaTimeoutId: ReturnType<typeof setTimeout> | null = null;
      let continueTimedOut = false;

      try {
        continueMetaTimeoutId = setTimeout(() => {
          continueTimedOut = true;
          controller.abort();
        }, 30_000);

        await continueGeneration(turnId, {
          signal: controller.signal,
          onMeta: (meta) => {
            if (controller.signal.aborted) return;
            if (continueMetaTimeoutId) {
              clearTimeout(continueMetaTimeoutId);
              continueMetaTimeoutId = null;
            }
            resolvedAssistantMessageId = meta.assistant_turn.id;
            resolvedAssistantCandidateId = meta.assistant_turn.candidate_id;
            setMessages((prev) =>
              prev.map((message) =>
                message.id === tempAssistantId || message.id === resolvedAssistantMessageId
                  ? {
                      ...message,
                      id: resolvedAssistantMessageId,
                      assistantTurnId: meta.assistant_turn.id,
                      assistantCandidateId: meta.assistant_turn.candidate_id,
                      candidateNo: message.candidateNo ?? 1,
                      candidateCount: message.candidateCount ?? 1,
                    }
                  : message,
              ),
            );
          },
          onChunk: (chunk) => {
            if (controller.signal.aborted) return;
            setMessages((prev) =>
              prev.map((message) =>
                message.id === tempAssistantId || message.id === resolvedAssistantMessageId
                  ? {
                      ...message,
                      content: message.content + chunk,
                      isTemp: (message.content + chunk).trim().length === 0,
                      messageStreamStatus: "streaming",
                    }
                  : message,
              ),
            );
          },
          onDone: async (fullContent, assistantTurnId, assistantCandidateId) => {
            if (controller.signal.aborted) return;
            if (assistantCandidateId) {
              resolvedAssistantCandidateId = assistantCandidateId;
            }
            setMessages((prev) =>
              prev.map((message) =>
                message.id === tempAssistantId || message.id === resolvedAssistantMessageId
                  ? {
                      ...message,
                      id: assistantTurnId ?? resolvedAssistantMessageId,
                      content: fullContent,
                      assistantTurnId: assistantTurnId ?? message.assistantTurnId,
                      assistantCandidateId:
                        assistantCandidateId ?? message.assistantCandidateId,
                      isTemp: false,
                      candidateNo: message.candidateNo ?? 1,
                      candidateCount: message.candidateCount ?? 1,
                      messageStreamStatus: "done",
                    }
                  : message,
              ),
            );
            setIsStreaming(false);
            detachControllerToTail(controller);
          },
          onReplySuggestions: (data) => {
            if (controller.signal.aborted) return;
            if (data.suggestions && data.suggestions.length > 0) {
              applyReplySuggestions(
                data.assistant_candidate_id,
                data.suggestions,
              );
            }
          },
          onReplyCardStarted: (data) => {
            if (controller.signal.aborted) return;
            setMessages((prev) =>
              prev.map((message) =>
                message.id === resolvedAssistantMessageId ||
                message.assistantCandidateId === data.assistant_candidate_id
                  ? {
                      ...message,
                      replyCardStatus: "loading",
                      replyCardErrorCode: null,
                    }
                  : message,
              ),
            );
          },
          onReplyCard: (data) => {
            if (controller.signal.aborted) return;
            setMessages((prev) =>
              prev.map((message) =>
                message.id === resolvedAssistantMessageId ||
                message.assistantCandidateId === data.assistant_candidate_id
                  ? {
                      ...message,
                      assistantCandidateId:
                        message.assistantCandidateId ?? data.assistant_candidate_id,
                      replyCard: data.reply_card,
                      replyCardStatus: "ready",
                      replyCardErrorCode: null,
                    }
                  : message,
              ),
            );
          },
          onReplyCardError: (data) => {
            if (controller.signal.aborted) return;
            setMessages((prev) =>
              prev.map((message) =>
                message.id === resolvedAssistantMessageId ||
                message.assistantCandidateId === data.assistant_candidate_id ||
                (!message.assistantCandidateId &&
                  resolvedAssistantCandidateId === data.assistant_candidate_id &&
                  (message.id === tempAssistantId || message.id === resolvedAssistantMessageId))
                  ? {
                      ...message,
                      assistantCandidateId:
                        message.assistantCandidateId ?? data.assistant_candidate_id,
                      replyCardStatus: "error",
                      replyCardErrorCode: data.code,
                    }
                  : message,
              ),
            );
          },
          onTtsAudioDelta: (data) => {
            if (controller.signal.aborted) return;
            if (!autoReadAloudRef.current) return;
            ttsPlaybackManager?.feedRealtimeChunk(
              data.assistant_candidate_id,
              data.audio_b64,
              data.mime_type,
              data.seq,
            );
          },
          onTtsAudioDone: (data) => {
            if (controller.signal.aborted) return;
            ttsPlaybackManager?.finishRealtime(data.assistant_candidate_id);
          },
          onTtsError: (data) => {
            if (controller.signal.aborted) return;
            ttsPlaybackManager?.handleTtsError(data.code, data.message);
          },
          onError: async (err) => {
            if (controller.signal.aborted) return;
            if (continueMetaTimeoutId) {
              clearTimeout(continueMetaTimeoutId);
              continueMetaTimeoutId = null;
            }
            hasStreamError = true;
            const errorMessage = getErrorMessage(err);
            setMessages((prev) =>
              prev.map((message) =>
                message.id === tempAssistantId || message.id === resolvedAssistantMessageId
                  ? {
                      ...message,
                      content: "",
                      messageStreamStatus: "error",
                      errorMessage,
                      replyCardStatus:
                        deriveReplyCardStatus(message) === "loading"
                          ? "idle"
                          : message.replyCardStatus,
                    }
                  : message,
              ),
            );
            setIsStreaming(false);
            clearTrackedController(controller);
          },
        });
        if (
          !controller.signal.aborted &&
          hasStreamError &&
          shouldReloadForRequest(requestRunId)
        ) {
          await reloadChatTurns({
            requiredTurnIds: [resolvedAssistantMessageId],
          });
        }
      } catch (err) {
        if (continueTimedOut) {
          finalizeStreamError(
            new Error("STREAM_TIMEOUT"),
            controller,
            continueMetaTimeoutId,
            (id) => { continueMetaTimeoutId = id; },
            [tempAssistantId, resolvedAssistantMessageId].filter(Boolean),
          );
        } else if (!controller.signal.aborted) {
          finalizeStreamError(
            err,
            controller,
            continueMetaTimeoutId,
            (id) => { continueMetaTimeoutId = id; },
            [tempAssistantId, resolvedAssistantMessageId].filter(Boolean),
          );
        }
      } finally {
        clearTrackedController(controller);
        if (continueMetaTimeoutId) {
          clearTimeout(continueMetaTimeoutId);
          continueMetaTimeoutId = null;
        }
      }
    },
    [
      applyReplySuggestions,
      autoReadAloudRef,
      beginStream,
      character?.status,
      clearReplySuggestions,
      clearTrackedController,
      detachControllerToTail,
      finalizeStreamError,
      isStreaming,
      reloadChatTurns,
      shouldReloadForRequest,
      ttsPlaybackManager,
    ],
  );

  const handleEditUser = useCallback(
    async (turnId: string, newContent: string) => {
      if (isStreaming || character?.status === "UNPUBLISHED") return;
      let hasStreamError = false;

      ttsPlaybackManager?.interruptAll();
      await ttsPlaybackManager?.ensureResumedForRealtime();

      const tempAssistantId = `assistant-edit-${crypto.randomUUID()}`;
      let resolvedAssistantMessageId = tempAssistantId;
      let resolvedAssistantCandidateId: string | undefined;
      let editAborted = false;

      setMessages((prev) => {
        const idx = prev.findIndex((message) => message.id === turnId);
        if (idx < 0) {
          editAborted = true;
          return prev;
        }
        const userMessage = prev[idx];
        const nextCandidateNo = Math.min(10, (userMessage.candidateCount ?? 1) + 1);

        const next = prev.slice(0, idx + 1).map((message) => {
          if (message.id !== turnId) return message;
          return {
            ...message,
            content: newContent,
            candidateNo: nextCandidateNo,
            candidateCount: nextCandidateNo,
            inputTransform: null,
            transformChunks: undefined,
          };
        });
        next.push({
          id: tempAssistantId,
          role: "assistant",
          content: "",
          isTemp: true,
          candidateNo: nextCandidateNo,
          candidateCount: nextCandidateNo,
          messageStreamStatus: "streaming",
          replyCardStatus: "idle",
          replyCardErrorCode: null,
        });
        return next;
      });

      if (editAborted) return;
      clearReplySuggestions();

      const { controller, requestRunId } = beginStream();
      setIsStreaming(true);

      let editMetaTimeoutId: ReturnType<typeof setTimeout> | null = null;
      let editTimedOut = false;

      try {
        editMetaTimeoutId = setTimeout(() => {
          editTimedOut = true;
          controller.abort();
        }, 30_000);

        await editUserTurnAndStreamReply(
          turnId,
          { content: newContent },
          {
            signal: controller.signal,
            onMeta: (meta) => {
              if (controller.signal.aborted) return;
              if (editMetaTimeoutId) {
                clearTimeout(editMetaTimeoutId);
                editMetaTimeoutId = null;
              }
              resolvedAssistantMessageId = meta.assistant_turn.id;
              resolvedAssistantCandidateId = meta.assistant_turn.candidate_id;
              setMessages((prev) =>
                prev.map((message) =>
                  message.id === tempAssistantId ||
                  message.id === resolvedAssistantMessageId
                    ? {
                        ...message,
                        id: resolvedAssistantMessageId,
                        assistantTurnId: meta.assistant_turn.id,
                        assistantCandidateId: meta.assistant_turn.candidate_id,
                      }
                    : message,
                ),
              );
            },
            onChunk: (chunk) => {
              if (controller.signal.aborted) return;
              setMessages((prev) =>
                prev.map((message) =>
                  message.id === tempAssistantId ||
                  message.id === resolvedAssistantMessageId
                    ? {
                        ...message,
                        content: message.content + chunk,
                        messageStreamStatus: "streaming",
                      }
                    : message,
                ),
              );
            },
            onTransformDone: (data) => {
              if (controller.signal.aborted) return;
              setMessages((prev) =>
                prev.map((message) =>
                  message.id === turnId
                    ? {
                        ...message,
                        inputTransform: data.applied
                          ? {
                              applied: true,
                              transformed_content: data.transformed_content,
                            }
                          : null,
                        transformChunks: undefined,
                      }
                    : message,
                ),
              );
            },
            onDone: async (fullContent, assistantTurnId, assistantCandidateId) => {
              if (controller.signal.aborted) return;
              if (assistantTurnId) {
                resolvedAssistantMessageId = assistantTurnId;
              }
              if (assistantCandidateId) {
                resolvedAssistantCandidateId = assistantCandidateId;
              }
              setMessages((prev) =>
                prev.map((message) =>
                  message.id === tempAssistantId ||
                  message.id === resolvedAssistantMessageId
                    ? {
                        ...message,
                        id: resolvedAssistantMessageId,
                        content: fullContent,
                        isTemp: false,
                        assistantTurnId: assistantTurnId ?? message.assistantTurnId,
                        assistantCandidateId:
                          assistantCandidateId ??
                          resolvedAssistantCandidateId ??
                          message.assistantCandidateId,
                        messageStreamStatus: "done",
                      }
                    : message,
                ),
              );
              setIsStreaming(false);
              detachControllerToTail(controller);
            },
            onReplySuggestions: (data) => {
              if (controller.signal.aborted) return;
              if (data.suggestions && data.suggestions.length > 0) {
                applyReplySuggestions(
                  data.assistant_candidate_id,
                  data.suggestions,
                );
              }
            },
            onReplyCardStarted: (data) => {
              if (controller.signal.aborted) return;
              setMessages((prev) =>
                prev.map((message) =>
                  message.id === tempAssistantId ||
                  message.id === resolvedAssistantMessageId ||
                  message.assistantCandidateId === data.assistant_candidate_id
                    ? {
                        ...message,
                        replyCardStatus: "loading",
                        replyCardErrorCode: null,
                      }
                    : message,
                ),
              );
            },
            onReplyCard: (data) => {
              if (controller.signal.aborted) return;
              setMessages((prev) =>
                prev.map((message) =>
                  message.id === tempAssistantId ||
                  message.id === resolvedAssistantMessageId ||
                  message.assistantCandidateId === data.assistant_candidate_id
                    ? {
                        ...message,
                        id: resolvedAssistantMessageId,
                        isTemp: false,
                        assistantCandidateId:
                          message.assistantCandidateId ?? data.assistant_candidate_id,
                        replyCard: data.reply_card,
                        replyCardStatus: "ready",
                        replyCardErrorCode: null,
                      }
                    : message,
                ),
              );
            },
            onReplyCardError: (data) => {
              if (controller.signal.aborted) return;
              setMessages((prev) =>
                prev.map((message) =>
                  message.id === tempAssistantId ||
                  message.id === resolvedAssistantMessageId ||
                  message.assistantCandidateId === data.assistant_candidate_id
                    ? {
                        ...message,
                        id: resolvedAssistantMessageId,
                        assistantCandidateId:
                          message.assistantCandidateId ?? data.assistant_candidate_id,
                        replyCardStatus: "error",
                        replyCardErrorCode: data.code,
                      }
                    : message,
              ),
            );
          },
          onTtsAudioDelta: (data) => {
            if (controller.signal.aborted) return;
            if (!autoReadAloudRef.current) return;
            ttsPlaybackManager?.feedRealtimeChunk(
              data.assistant_candidate_id,
              data.audio_b64,
              data.mime_type,
              data.seq,
            );
          },
          onTtsAudioDone: (data) => {
            if (controller.signal.aborted) return;
            ttsPlaybackManager?.finishRealtime(data.assistant_candidate_id);
          },
          onTtsError: (data) => {
            if (controller.signal.aborted) return;
            ttsPlaybackManager?.handleTtsError(data.code, data.message);
          },
          onError: async (err) => {
            if (controller.signal.aborted) return;
            if (editMetaTimeoutId) {
              clearTimeout(editMetaTimeoutId);
              editMetaTimeoutId = null;
            }
            hasStreamError = true;
            const errorMessage = getErrorMessage(err);
              setMessages((prev) =>
                prev.map((message) =>
                  message.id === tempAssistantId ||
                  message.id === resolvedAssistantMessageId
                    ? {
                        ...message,
                        id: resolvedAssistantMessageId,
                        content: "",
                        messageStreamStatus: "error",
                        errorMessage,
                        replyCardStatus:
                          deriveReplyCardStatus(message) === "loading"
                            ? "idle"
                            : message.replyCardStatus,
                      }
                    : message,
                ),
              );
              setIsStreaming(false);
              clearTrackedController(controller);
            },
          },
        );
        if (
          !controller.signal.aborted &&
          hasStreamError &&
          shouldReloadForRequest(requestRunId)
        ) {
          await reloadChatTurns({
            requiredTurnIds: [turnId, resolvedAssistantMessageId],
          });
        }
      } catch (err) {
        if (editTimedOut) {
          finalizeStreamError(
            new Error("STREAM_TIMEOUT"),
            controller,
            editMetaTimeoutId,
            (id) => { editMetaTimeoutId = id; },
            [tempAssistantId, resolvedAssistantMessageId].filter(Boolean),
          );
        } else if (!controller.signal.aborted) {
          finalizeStreamError(
            err,
            controller,
            editMetaTimeoutId,
            (id) => { editMetaTimeoutId = id; },
            [tempAssistantId, resolvedAssistantMessageId].filter(Boolean),
          );
        }
      } finally {
        clearTrackedController(controller);
        if (editMetaTimeoutId) {
          clearTimeout(editMetaTimeoutId);
          editMetaTimeoutId = null;
        }
      }
    },
    [
      applyReplySuggestions,
      beginStream,
      character?.status,
      clearReplySuggestions,
      clearTrackedController,
      detachControllerToTail,
      finalizeStreamError,
      isStreaming,
      reloadChatTurns,
      shouldReloadForRequest,
      ttsPlaybackManager,
    ],
  );

  const handleSendMessage = useCallback(
    async (content: string) => {
      if (!character || !canSend || character.status === "UNPUBLISHED") return;

      if (isStreaming) {
        abortActiveTextStream();
        setIsStreaming(false);
        setMessages((prev) =>
          prev.filter((message) => message.role === "user" || !message.isTemp),
        );
      }

      ttsPlaybackManager?.interruptAll();
      await ttsPlaybackManager?.ensureResumedForRealtime();

      const tempUserId = `user-${crypto.randomUUID()}`;
      const tempAssistantId = `assistant-${crypto.randomUUID()}`;
      let resolvedUserMessageId = tempUserId;
      let resolvedAssistantMessageId = tempAssistantId;
      let resolvedAssistantCandidateId: string | undefined;

      const userMessage: Message = {
        id: tempUserId,
        role: "user",
        content,
        isTemp: true,
      };
      setMessages((prev) => [...prev, userMessage]);

      clearReplySuggestions();

      setMessages((prev) => [
        ...prev,
        {
          id: tempAssistantId,
          role: "assistant",
          content: "",
          isTemp: true,
          messageStreamStatus: "streaming",
          replyCardStatus: "idle",
          replyCardErrorCode: null,
        },
      ]);

      const { controller, requestRunId } = beginStream();
      setIsStreaming(true);

      let sendMetaTimeoutId: ReturnType<typeof setTimeout> | null = null;
      let sendTimedOut = false;

      try {
        sendMetaTimeoutId = setTimeout(() => {
          sendTimedOut = true;
          controller.abort();
        }, 30_000);

        await streamChatMessage(
          chatId,
          { content },
          {
            signal: controller.signal,
            onMeta: (meta) => {
              if (controller.signal.aborted) return;
              if (sendMetaTimeoutId) {
                clearTimeout(sendMetaTimeoutId);
                sendMetaTimeoutId = null;
              }
              resolvedUserMessageId = meta.user_turn.id;
              resolvedAssistantMessageId = meta.assistant_turn.id;
              resolvedAssistantCandidateId = meta.assistant_turn.candidate_id;

              setMessages((prev) =>
                prev.map((message) => {
                  if (message.id === tempUserId || message.id === resolvedUserMessageId) {
                    return {
                      ...message,
                      id: resolvedUserMessageId,
                      isTemp: false,
                      candidateNo: message.candidateNo ?? 1,
                      candidateCount: message.candidateCount ?? 1,
                    };
                  }

                  if (
                    message.id === tempAssistantId ||
                    message.id === resolvedAssistantMessageId
                  ) {
                    return {
                      ...message,
                      id: resolvedAssistantMessageId,
                      assistantTurnId: meta.assistant_turn.id,
                      assistantCandidateId: meta.assistant_turn.candidate_id,
                      candidateNo: message.candidateNo ?? 1,
                      candidateCount: message.candidateCount ?? 1,
                      messageStreamStatus: "streaming",
                      replyCardStatus: "idle",
                      replyCardErrorCode: null,
                    };
                  }

                  return message;
                }),
              );
            },
            onChatTitleUpdated: (data) => {
              if (controller.signal.aborted) return;
              if (data.chat_id !== chatId) return;
              setCurrentChatTitle(data.title);
            },
            onTransformChunk: (chunk) => {
              if (controller.signal.aborted) return;
              setMessages((prev) =>
                prev.map((message) =>
                  message.id === tempUserId || message.id === resolvedUserMessageId
                    ? {
                        ...message,
                        transformChunks: (message.transformChunks || "") + chunk,
                      }
                    : message,
                ),
              );
            },
            onTransformDone: (data) => {
              if (controller.signal.aborted) return;
              if (data.applied) {
                setMessages((prev) =>
                  prev.map((message) =>
                    message.id === tempUserId || message.id === resolvedUserMessageId
                      ? {
                          ...message,
                          transformChunks: undefined,
                          inputTransform: {
                            applied: true,
                            transformed_content: data.transformed_content,
                          },
                        }
                      : message,
                  ),
                );
              } else {
                setMessages((prev) =>
                  prev.map((message) =>
                    message.id === tempUserId || message.id === resolvedUserMessageId
                      ? { ...message, transformChunks: undefined }
                      : message,
                  ),
                );
              }
            },
            onChunk: (chunk) => {
              if (controller.signal.aborted) return;
              setMessages((prev) =>
                prev.map((message) =>
                  message.id === tempAssistantId ||
                  message.id === resolvedAssistantMessageId
                    ? {
                        ...message,
                        content: message.content + chunk,
                        isTemp: (message.content + chunk).trim().length === 0,
                        messageStreamStatus: "streaming",
                      }
                    : message,
                ),
              );
            },
            onDone: async (
              fullContent,
              assistantTurnId,
              assistantCandidateId,
            ) => {
              if (controller.signal.aborted) return;
              if (assistantTurnId) {
                resolvedAssistantMessageId = assistantTurnId;
              }
              if (assistantCandidateId) {
                resolvedAssistantCandidateId = assistantCandidateId;
              }

              setMessages((prev) =>
                prev.map((message) =>
                  message.id === tempAssistantId ||
                  message.id === resolvedAssistantMessageId
                    ? {
                        ...message,
                        id: resolvedAssistantMessageId,
                        content: fullContent,
                        assistantTurnId: assistantTurnId ?? message.assistantTurnId,
                        assistantCandidateId:
                          assistantCandidateId ?? message.assistantCandidateId,
                        isTemp: false,
                        candidateNo: message.candidateNo ?? 1,
                        candidateCount: message.candidateCount ?? 1,
                        messageStreamStatus: "done",
                      }
                    : message,
                ),
              );
              setMessages((prev) =>
                prev.map((message) =>
                  message.id === tempUserId || message.id === resolvedUserMessageId
                    ? {
                        ...message,
                        id: resolvedUserMessageId,
                        isTemp: false,
                        candidateNo: message.candidateNo ?? 1,
                        candidateCount: message.candidateCount ?? 1,
                      }
                    : message,
                ),
              );
              setIsStreaming(false);
              detachControllerToTail(controller);
            },
            onReplySuggestions: (data) => {
              if (controller.signal.aborted) return;
              if (data.suggestions && data.suggestions.length > 0) {
                applyReplySuggestions(
                  data.assistant_candidate_id,
                  data.suggestions,
                );
              }
            },
            onReplyCardStarted: (data) => {
              if (controller.signal.aborted) return;
              setMessages((prev) =>
                prev.map((message) =>
                  message.id === tempAssistantId ||
                  message.id === resolvedAssistantMessageId ||
                  message.assistantCandidateId === data.assistant_candidate_id
                    ? {
                        ...message,
                        replyCardStatus: "loading",
                        replyCardErrorCode: null,
                      }
                    : message,
                ),
              );
            },
            onReplyCard: (data) => {
              if (controller.signal.aborted) return;
              setMessages((prev) =>
                prev.map((message) =>
                  message.id === tempAssistantId ||
                  message.id === resolvedAssistantMessageId ||
                  message.assistantCandidateId === data.assistant_candidate_id
                    ? {
                        ...message,
                        assistantCandidateId:
                          message.assistantCandidateId ?? data.assistant_candidate_id,
                        replyCard: data.reply_card,
                        replyCardStatus: "ready",
                        replyCardErrorCode: null,
                      }
                    : message,
                ),
              );
            },
            onReplyCardError: (data) => {
              if (controller.signal.aborted) return;
              setMessages((prev) =>
                prev.map((message) =>
                  message.id === tempAssistantId ||
                  message.id === resolvedAssistantMessageId ||
                  message.assistantCandidateId === data.assistant_candidate_id ||
                  (!message.assistantCandidateId &&
                    resolvedAssistantCandidateId === data.assistant_candidate_id &&
                    (message.id === tempAssistantId ||
                      message.id === resolvedAssistantMessageId))
                    ? {
                        ...message,
                        assistantCandidateId:
                          message.assistantCandidateId ?? data.assistant_candidate_id,
                        replyCardStatus: "error",
                        replyCardErrorCode: data.code,
                      }
                    : message,
                ),
              );
            },
            onTtsAudioDelta: (data) => {
              if (controller.signal.aborted) return;
              if (!autoReadAloudRef.current) return;
              ttsPlaybackManager?.feedRealtimeChunk(
                data.assistant_candidate_id,
                data.audio_b64,
                data.mime_type,
                data.seq,
              );
            },
            onTtsAudioDone: (data) => {
              if (controller.signal.aborted) return;
              ttsPlaybackManager?.finishRealtime(data.assistant_candidate_id);
            },
            onTtsError: (data) => {
              if (controller.signal.aborted) return;
              ttsPlaybackManager?.handleTtsError(data.code, data.message);
            },
            onGrowthDailyUpdated: (data) => {
              if (controller.signal.aborted) return;
              onGrowthDailyUpdated?.(data.today);
              onGrowthDailyRefresh?.();
            },
            onGrowthShareCardReady: (data) => {
              if (controller.signal.aborted) return;
              onGrowthShareCardReady?.(data.share_card);
            },
            onError: async (err) => {
              if (controller.signal.aborted) return;
              if (sendMetaTimeoutId) {
                clearTimeout(sendMetaTimeoutId);
                sendMetaTimeoutId = null;
              }
              const errorMessage = getErrorMessage(err);
              setMessages((prev) =>
                prev.map((message) =>
                  message.id === tempAssistantId ||
                  message.id === resolvedAssistantMessageId
                    ? {
                        ...message,
                        content: "",
                        messageStreamStatus: "error",
                        errorMessage,
                        replyCardStatus:
                          deriveReplyCardStatus(message) === "loading"
                            ? "idle"
                            : message.replyCardStatus,
                      }
                    : message,
                ),
              );
              setIsStreaming(false);
              clearTrackedController(controller);
              if (shouldReloadForRequest(requestRunId)) {
                await reloadChatTurns({
                  requiredTurnIds: [
                    resolvedUserMessageId,
                    resolvedAssistantMessageId,
                  ],
                });
              }
            },
          },
        );

      } catch (err) {
        if (sendTimedOut) {
          finalizeStreamError(
            new Error("STREAM_TIMEOUT"),
            controller,
            sendMetaTimeoutId,
            (id) => { sendMetaTimeoutId = id; },
            [tempAssistantId, resolvedAssistantMessageId].filter(Boolean),
            content,
          );
        } else if (!controller.signal.aborted) {
          finalizeStreamError(
            err,
            controller,
            sendMetaTimeoutId,
            (id) => { sendMetaTimeoutId = id; },
            [tempAssistantId, resolvedAssistantMessageId].filter(Boolean),
            content,
          );
        }
      } finally {
        clearTrackedController(controller);
        if (sendMetaTimeoutId) {
          clearTimeout(sendMetaTimeoutId);
          sendMetaTimeoutId = null;
        }
      }
    },
    [
      abortActiveTextStream,
      applyReplySuggestions,
      beginStream,
      canSend,
      character,
      chatId,
      clearReplySuggestions,
      clearTrackedController,
      detachControllerToTail,
      finalizeStreamError,
      isStreaming,
      reloadChatTurns,
      setCurrentChatTitle,
      shouldReloadForRequest,
      ttsPlaybackManager,
      onGrowthDailyUpdated,
      onGrowthDailyRefresh,
      onGrowthShareCardReady,
    ],
  );

  const interruptAllTts = useCallback(() => {
    ttsPlaybackManager?.interruptAll();
  }, [ttsPlaybackManager]);

  const interruptStream = useCallback(() => {
    abortActiveTextStream();
    setIsStreaming(false);
    setMessages((prev) => prev.filter((msg) => msg.role === "user" || !msg.isTemp));
  }, [abortActiveTextStream]);

  const handleRetrySend = useCallback(
    (errorMessageId: string) => {
      let retryContent = "";
      setMessages((prev) => {
        const errorIdx = prev.findIndex((msg) => msg.id === errorMessageId);
        if (errorIdx < 0) return prev;
        retryContent = prev[errorIdx].retryContent ?? "";
        // Remove the error message and the preceding temp user message
        return prev.filter((msg, idx) => {
          if (msg.id === errorMessageId) return false;
          // Remove temp user message right before the error message
          if (idx === errorIdx - 1 && msg.role === "user" && msg.isTemp) return false;
          return true;
        });
      });
      if (retryContent) {
        // Use microtask to ensure state is flushed before sending
        void Promise.resolve().then(() => handleSendMessage(retryContent));
      }
    },
    [setMessages, handleSendMessage],
  );

  return {
    chat,
    character,
    messages,
    isStreaming,
    isLoading,
    error,
    currentReplySuggestions,
    clearReplySuggestions,
    characterId: characterIdRef.current,
    setCurrentChatTitle,
    handleSelectCandidate,
    handleRegenAssistant,
    handleContinue,
    handleEditUser,
    handleRetryReplyCard,
    handleSendMessage,
    handleRetrySend,
    interruptAllTts,
    interruptStream,
    loadOlderMessages,
    hasOlderMessages,
    isLoadingOlder,
    reloadChatTurns,
  };
}
