"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  createReplyCard,
  editUserTurnAndStreamReply,
  getChatTurns,
  regenAssistantTurn,
  selectTurnCandidateWithSnapshot,
  streamChatMessage,
  type TurnsPageResponse,
} from "@/lib/api";
import { mapCharacterToSidebar } from "@/lib/character-adapter";
import { snapshotContainsTurnIds } from "@/lib/chat-turn-snapshot";
import { getErrorMessage } from "@/lib/error-map";
import type { TtsPlaybackManager } from "@/lib/voice/tts-playback-manager";

interface UseChatSessionArgs {
  chatId: string;
  isAuthed: boolean;
  canSend: boolean;
  setSelectedCharacterId: (id: string | null) => void;
  ttsPlaybackManager?: TtsPlaybackManager | null;
  autoReadAloudEnabled?: boolean;
  onGrowthDailyUpdated?: (today: GrowthTodaySummary) => void;
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
  handleEditUser: (turnId: string, newContent: string) => Promise<void>;
  handleRetryReplyCard: (message: Message) => Promise<void>;
  handleSendMessage: (content: string) => Promise<void>;
  interruptAllTts: () => void;
  interruptStream: () => void;
  loadOlderMessages: () => Promise<void>;
  hasOlderMessages: boolean;
  isLoadingOlder: boolean;
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
  const replyCard = turn.primary_candidate.extra?.reply_card ?? null;

  return {
    id: turn.id,
    role: turn.author_type === "USER" ? "user" : "assistant",
    content: turn.primary_candidate.content,
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
    messageStreamStatus: isAssistant ? "done" : undefined,
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
  onGrowthShareCardReady,
}: UseChatSessionArgs): UseChatSessionResult {
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

  const streamAbortRef = useRef<AbortController | null>(null);
  const tailAbortControllersRef = useRef<Set<AbortController>>(new Set());
  const requestRunIdRef = useRef(0);
  const selectCandidateInFlightRef = useRef(false);
  const replyCardRetryInFlightRef = useRef<Set<string>>(new Set());
  const characterIdRef = useRef<string | null>(null);
  const replySuggestionsByCandidateIdRef = useRef<ReplySuggestionsByCandidateId>({});
  const autoReadAloudRef = useRef(autoReadAloudEnabled);
  useEffect(() => {
    autoReadAloudRef.current = autoReadAloudEnabled;
  }, [autoReadAloudEnabled]);

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

    setError(null);

    const data: TurnsPageResponse = await getChatTurns(chatId, { limit: 50 });

    if (
      options?.requiredTurnIds &&
      !snapshotContainsTurnIds(data.turns, options.requiredTurnIds)
    ) {
      return;
    }

    beforeTurnIdRef.current = data.next_before_turn_id ?? null;
    setHasOlderMessages(data.has_more);

    applyTurnsPage(data);
  }, [applyTurnsPage, chatId, isAuthed]);

  const loadOlderMessages = useCallback(async () => {
    if (!chatId || !isAuthed || isLoadingOlder || !hasOlderMessages) return;
    if (!beforeTurnIdRef.current) return;

    setIsLoadingOlder(true);
    try {
      const data = await getChatTurns(chatId, {
        before_turn_id: beforeTurnIdRef.current,
        limit: 50,
      });

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
    }
  }, [chatId, isAuthed, isLoadingOlder, hasOlderMessages]);

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
        setHasOlderMessages(true);
        setIsLoadingOlder(false);
        await reloadChatTurns();
      } catch (err) {
        console.error("Failed to load chat:", err);
        setError(getErrorMessage(err));
      } finally {
        setIsLoading(false);
      }
    }

    loadChat();

      return () => {
      abortAllTrackedControllers();
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
        applyTurnsPage(result.snapshot);
      } catch (err) {
        console.error("Failed to select candidate:", err);
        setError(getErrorMessage(err));
      } finally {
        selectCandidateInFlightRef.current = false;
      }
    },
    [abortAllTrackedControllers, applyTurnsPage, clearReplySuggestions, isStreaming],
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

  const handleRegenAssistant = useCallback(
    async (turnId: string) => {
      if (isStreaming) return;
      let shouldReloadAfterStream = false;
      let hasStreamError = false;
      let resolvedAssistantCandidateId: string | undefined;

      ttsPlaybackManager?.interruptAll();
      void ttsPlaybackManager?.ensureResumed().catch(() => {});

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

      try {
        await regenAssistantTurn(turnId, {
          signal: controller.signal,
          onMeta: (meta) => {
            if (controller.signal.aborted) return;
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
            shouldReloadAfterStream = true;
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
            hasStreamError = true;
            const errorMessage = getErrorMessage(err);
            setMessages((prev) =>
              prev.map((message) =>
                message.id === turnId
                  ? {
                      ...message,
                      content: `Error: ${errorMessage}`,
                      messageStreamStatus: "error",
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
          (shouldReloadAfterStream || hasStreamError) &&
          shouldReloadForRequest(requestRunId)
        ) {
          await reloadChatTurns({
            requiredTurnIds: [turnId],
          });
        }
      } finally {
        clearTrackedController(controller);
      }
    },
    [
      applyReplySuggestions,
      beginStream,
      clearReplySuggestions,
      clearTrackedController,
      detachControllerToTail,
      isStreaming,
      reloadChatTurns,
      shouldReloadForRequest,
      ttsPlaybackManager,
    ],
  );

  const handleEditUser = useCallback(
    async (turnId: string, newContent: string) => {
      if (isStreaming) return;
      let shouldReloadAfterStream = false;
      let hasStreamError = false;

      ttsPlaybackManager?.interruptAll();
      void ttsPlaybackManager?.ensureResumed().catch(() => {});

      const idx = messages.findIndex((message) => message.id === turnId);
      if (idx < 0) return;

      const tempAssistantId = `assistant-edit-${Date.now()}`;
      let resolvedAssistantMessageId = tempAssistantId;
      let resolvedAssistantCandidateId: string | undefined;

      const userMessage = messages[idx];
      const nextCandidateNo = Math.min(10, (userMessage.candidateCount ?? 1) + 1);

      setMessages((prev) => {
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
      clearReplySuggestions();

      const { controller, requestRunId } = beginStream();
      setIsStreaming(true);

      try {
        await editUserTurnAndStreamReply(
          turnId,
          { content: newContent },
          {
            signal: controller.signal,
            onMeta: (meta) => {
              if (controller.signal.aborted) return;
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
              shouldReloadAfterStream = true;
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
            hasStreamError = true;
            const errorMessage = getErrorMessage(err);
              setMessages((prev) =>
                prev.map((message) =>
                  message.id === tempAssistantId ||
                  message.id === resolvedAssistantMessageId
                    ? {
                        ...message,
                        id: resolvedAssistantMessageId,
                        content: `Error: ${errorMessage}`,
                        messageStreamStatus: "error",
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
          (shouldReloadAfterStream || hasStreamError) &&
          shouldReloadForRequest(requestRunId)
        ) {
          await reloadChatTurns({
            requiredTurnIds: [turnId, resolvedAssistantMessageId],
          });
        }
      } finally {
        clearTrackedController(controller);
      }
    },
    [
      applyReplySuggestions,
      beginStream,
      clearReplySuggestions,
      clearTrackedController,
      detachControllerToTail,
      isStreaming,
      messages,
      reloadChatTurns,
      shouldReloadForRequest,
      ttsPlaybackManager,
    ],
  );

  const handleSendMessage = useCallback(
    async (content: string) => {
      if (!character || !canSend || isStreaming) return;

      ttsPlaybackManager?.interruptAll();
      void ttsPlaybackManager?.ensureResumed().catch(() => {});

      const tempUserId = `user-${Date.now()}`;
      const tempAssistantId = `assistant-${Date.now()}`;
      let resolvedUserMessageId = tempUserId;
      let resolvedAssistantMessageId = tempAssistantId;
      let resolvedAssistantCandidateId: string | undefined;
      let shouldReloadAfterStream = false;
      let hasStreamError = false;

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

      try {
        await streamChatMessage(
          chatId,
          { content },
          {
            signal: controller.signal,
            onMeta: (meta) => {
              if (controller.signal.aborted) return;
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
              shouldReloadAfterStream = true;
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
              window.dispatchEvent(new Event("growth:header:refresh"));
            },
            onGrowthShareCardReady: (data) => {
              if (controller.signal.aborted) return;
              onGrowthShareCardReady?.(data.share_card);
            },
            onError: async (err) => {
              if (controller.signal.aborted) return;
              hasStreamError = true;
              const errorMessage = getErrorMessage(err);
              console.error("Chat error:", err);
              setMessages((prev) =>
                prev.map((message) =>
                  message.id === tempAssistantId ||
                  message.id === resolvedAssistantMessageId
                    ? {
                        ...message,
                        content: `Error: ${errorMessage}`,
                        messageStreamStatus: "error",
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

        if (
          !controller.signal.aborted &&
          shouldReloadAfterStream &&
          !hasStreamError &&
          shouldReloadForRequest(requestRunId)
        ) {
          await reloadChatTurns({
            requiredTurnIds: [
              resolvedUserMessageId,
              resolvedAssistantMessageId,
            ],
          });
        }
      } finally {
        clearTrackedController(controller);
      }
    },
    [
      applyReplySuggestions,
      beginStream,
      canSend,
      character,
      chatId,
      clearReplySuggestions,
      clearTrackedController,
      detachControllerToTail,
      isStreaming,
      reloadChatTurns,
      setCurrentChatTitle,
      shouldReloadForRequest,
      ttsPlaybackManager,
      onGrowthDailyUpdated,
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
    handleEditUser,
    handleRetryReplyCard,
    handleSendMessage,
    interruptAllTts,
    interruptStream,
    loadOlderMessages,
    hasOlderMessages,
    isLoadingOlder,
  };
}
