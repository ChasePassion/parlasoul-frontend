"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  Message,
  MessageActionStatus,
} from "@/components/ChatMessage";
import type { Character } from "@/components/Sidebar";
import type { ReplySuggestion } from "@/lib/api";
import {
  ApiError,
  UnauthorizedError,
  createSentenceCard,
  editUserTurnAndStreamReply,
  getChatTurns,
  regenAssistantTurn,
  selectTurnCandidateWithSnapshot,
  streamChatMessage,
  type TurnsPageResponse,
} from "@/lib/api";
import { mapCharacterToSidebar } from "@/lib/character-adapter";
import type { TtsPlaybackManager } from "@/lib/voice/tts-playback-manager";

interface UseChatSessionArgs {
  chatId: string;
  isAuthed: boolean;
  canSend: boolean;
  setSelectedCharacterId: (id: string | null) => void;
  ttsPlaybackManager?: TtsPlaybackManager | null;
  autoReadAloudEnabled?: boolean;
}

interface UseChatSessionResult {
  character: Character | null;
  messages: Message[];
  isStreaming: boolean;
  isLoading: boolean;
  error: string | null;
  currentReplySuggestions: ReplySuggestion[] | null;
  clearReplySuggestions: () => void;
  characterId: string | null;
  handleSelectCandidate: (turnId: string, candidateNo: number) => Promise<void>;
  handleRegenAssistant: (turnId: string) => Promise<void>;
  handleEditUser: (turnId: string, newContent: string) => Promise<void>;
  handleRetrySentenceCard: (message: Message) => Promise<void>;
  handleSendMessage: (content: string) => Promise<void>;
  interruptAllTts: () => void;
  interruptStream: () => void;
}

const deriveSentenceCardStatus = (message: {
  sentenceCard?: Message["sentenceCard"];
  sentenceCardStatus?: MessageActionStatus;
}): MessageActionStatus =>
  message.sentenceCardStatus ?? (message.sentenceCard ? "ready" : "idle");

const deriveSentenceCardErrorCode = (error: unknown): string => {
  if (error instanceof ApiError) {
    return error.code || `http_${error.status}`;
  }
  if (error instanceof UnauthorizedError) {
    return "unauthorized";
  }
  return "sentence_card_request_failed";
};

const mapTurnsPageMessage = (turn: TurnsPageResponse["turns"][number]): Message => {
  const isAssistant = turn.author_type === "CHARACTER";
  const sentenceCard = turn.primary_candidate.extra?.sentence_card ?? null;

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
    sentenceCard,
    assistantTurnId: isAssistant ? turn.id : undefined,
    assistantCandidateId: isAssistant ? turn.primary_candidate.id : undefined,
    messageStreamStatus: isAssistant ? "done" : undefined,
    sentenceCardStatus: isAssistant ? (sentenceCard ? "ready" : "idle") : undefined,
    sentenceCardErrorCode: null,
  };
};

export function useChatSession({
  chatId,
  isAuthed,
  canSend,
  setSelectedCharacterId,
  ttsPlaybackManager,
  autoReadAloudEnabled = true,
}: UseChatSessionArgs): UseChatSessionResult {
  const [character, setCharacter] = useState<Character | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentReplySuggestions, setCurrentReplySuggestions] = useState<
    ReplySuggestion[] | null
  >(null);

  const streamAbortRef = useRef<AbortController | null>(null);
  const selectCandidateInFlightRef = useRef(false);
  const sentenceCardRetryInFlightRef = useRef<Set<string>>(new Set());
  const characterIdRef = useRef<string | null>(null);
  const autoReadAloudRef = useRef(autoReadAloudEnabled);
  useEffect(() => {
    autoReadAloudRef.current = autoReadAloudEnabled;
  }, [autoReadAloudEnabled]);

  const clearActiveStream = useCallback((controller?: AbortController) => {
    if (!controller || streamAbortRef.current === controller) {
      streamAbortRef.current = null;
    }
  }, []);

  const beginStream = useCallback(() => {
    streamAbortRef.current?.abort();
    const controller = new AbortController();
    streamAbortRef.current = controller;
    return controller;
  }, []);

  const clearReplySuggestions = useCallback(() => {
    setCurrentReplySuggestions(null);
  }, []);

  const applyTurnsPage = useCallback(
    (data: TurnsPageResponse) => {
      const mappedCharacter: Character = mapCharacterToSidebar(data.character);

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
        const previousSentenceCardErrors = new Map<string, string | null>();
        prev.forEach((message) => {
          if (
            message.assistantCandidateId &&
            !message.sentenceCard &&
            deriveSentenceCardStatus(message) === "error"
          ) {
            previousSentenceCardErrors.set(
              message.assistantCandidateId,
              message.sentenceCardErrorCode ?? null,
            );
          }
        });

        return mappedMessages.map((message) => {
          if (
            message.role !== "assistant" ||
            message.sentenceCard ||
            !message.assistantCandidateId
          ) {
            return message;
          }

          if (!previousSentenceCardErrors.has(message.assistantCandidateId)) {
            return message;
          }

          return {
            ...message,
            sentenceCardStatus: "error",
            sentenceCardErrorCode:
              previousSentenceCardErrors.get(message.assistantCandidateId) ?? null,
          };
        });
      });
    },
    [setSelectedCharacterId],
  );

  const reloadChatTurns = useCallback(async () => {
    if (!chatId || !isAuthed) return;

    setError(null);

    const data: TurnsPageResponse = await getChatTurns(chatId, { limit: 50 });
    applyTurnsPage(data);
  }, [applyTurnsPage, chatId, isAuthed]);

  useEffect(() => {
    async function loadChat() {
      if (!chatId || !isAuthed) return;

      streamAbortRef.current?.abort();
      streamAbortRef.current = null;
      setIsLoading(true);
      setIsStreaming(false);
      setError(null);
      setCharacter(null);
      setMessages([]);
      setCurrentReplySuggestions(null);

      try {
        await reloadChatTurns();
      } catch (err) {
        console.error("Failed to load chat:", err);
        setError(err instanceof Error ? err.message : "Failed to load chat");
      } finally {
        setIsLoading(false);
      }
    }

    loadChat();

    return () => {
      streamAbortRef.current?.abort();
      streamAbortRef.current = null;
      setSelectedCharacterId(null);
    };
  }, [chatId, isAuthed, reloadChatTurns, setSelectedCharacterId]);

  const handleSelectCandidate = useCallback(
    async (turnId: string, candidateNo: number) => {
      if (isStreaming || selectCandidateInFlightRef.current) return;
      selectCandidateInFlightRef.current = true;
      try {
        setError(null);
        setCurrentReplySuggestions(null);
        const result = await selectTurnCandidateWithSnapshot(
          turnId,
          { candidate_no: candidateNo },
          { limit: 50, include_learning_data: true },
        );
        applyTurnsPage(result.snapshot);
      } catch (err) {
        console.error("Failed to select candidate:", err);
        setError(
          err instanceof Error ? err.message : "Failed to select candidate",
        );
      } finally {
        selectCandidateInFlightRef.current = false;
      }
    },
    [applyTurnsPage, isStreaming],
  );

  const handleRetrySentenceCard = useCallback(
    async (message: Message) => {
      const candidateId = message.assistantCandidateId;
      if (!candidateId || isStreaming || message.sentenceCard) return;
      if (sentenceCardRetryInFlightRef.current.has(candidateId)) return;

      sentenceCardRetryInFlightRef.current.add(candidateId);
      setMessages((prev) =>
        prev.map((current) =>
          current.assistantCandidateId === candidateId
            ? {
                ...current,
                sentenceCardStatus: "loading",
                sentenceCardErrorCode: null,
              }
            : current,
        ),
      );

      try {
        const data = await createSentenceCard(candidateId);
        setMessages((prev) =>
          prev.map((current) =>
            current.assistantCandidateId === candidateId
              ? {
                  ...current,
                  sentenceCard: data.sentence_card,
                  sentenceCardStatus: "ready",
                  sentenceCardErrorCode: null,
                }
              : current,
          ),
        );
      } catch (err) {
        const errorCode = deriveSentenceCardErrorCode(err);
        setMessages((prev) =>
          prev.map((current) =>
            current.assistantCandidateId === candidateId
              ? {
                  ...current,
                  sentenceCardStatus: "error",
                  sentenceCardErrorCode: errorCode,
                }
              : current,
          ),
        );
        throw err;
      } finally {
        sentenceCardRetryInFlightRef.current.delete(candidateId);
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

      setMessages((prev) =>
        prev.map((message) => {
          if (message.id !== turnId) return message;
          const nextCount = Math.min(10, (message.candidateCount ?? 1) + 1);
          return {
            ...message,
            content: "",
            candidateNo: nextCount,
            candidateCount: nextCount,
            sentenceCard: null,
            assistantCandidateId: undefined,
            messageStreamStatus: "streaming",
            sentenceCardStatus: "idle",
            sentenceCardErrorCode: null,
          };
        }),
      );
      setCurrentReplySuggestions(null);

      const controller = beginStream();
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
          onDone: async (fullContent) => {
            if (controller.signal.aborted) return;
            shouldReloadAfterStream = true;
            setMessages((prev) =>
              prev.map((message) =>
                message.id === turnId
                  ? {
                      ...message,
                      content: fullContent,
                      messageStreamStatus: "done",
                    }
                  : message,
              ),
            );
            setIsStreaming(false);
            clearActiveStream(controller);
          },
          onReplySuggestions: (suggestions) => {
            if (controller.signal.aborted) return;
            if (suggestions && suggestions.length > 0) {
              setCurrentReplySuggestions(suggestions);
            }
          },
          onSentenceCardStarted: (data) => {
            if (controller.signal.aborted) return;
            setMessages((prev) =>
              prev.map((message) =>
                message.id === turnId ||
                message.assistantCandidateId === data.assistant_candidate_id
                  ? {
                      ...message,
                      sentenceCardStatus: "loading",
                      sentenceCardErrorCode: null,
                    }
                  : message,
              ),
            );
          },
          onSentenceCard: (data) => {
            if (controller.signal.aborted) return;
            setMessages((prev) =>
              prev.map((message) =>
                message.id === turnId ||
                message.assistantCandidateId === data.assistant_candidate_id
                  ? {
                      ...message,
                      assistantCandidateId:
                        message.assistantCandidateId ?? data.assistant_candidate_id,
                      sentenceCard: data.sentence_card,
                      sentenceCardStatus: "ready",
                      sentenceCardErrorCode: null,
                    }
                  : message,
              ),
            );
          },
          onSentenceCardError: (data) => {
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
                      sentenceCardStatus: "error",
                      sentenceCardErrorCode: data.code,
                    }
                  : message,
              ),
            );
          },
          onError: async (errMsg) => {
            if (controller.signal.aborted) return;
            hasStreamError = true;
            setMessages((prev) =>
              prev.map((message) =>
                message.id === turnId
                  ? {
                      ...message,
                      content: `Error: ${errMsg}`,
                      messageStreamStatus: "error",
                      sentenceCardStatus:
                        deriveSentenceCardStatus(message) === "loading"
                          ? "idle"
                          : message.sentenceCardStatus,
                    }
                  : message,
              ),
            );
            setIsStreaming(false);
            clearActiveStream(controller);
          },
        });
        if (
          !controller.signal.aborted &&
          (shouldReloadAfterStream || hasStreamError)
        ) {
          await reloadChatTurns();
        }
      } finally {
        clearActiveStream(controller);
      }
    },
    [beginStream, clearActiveStream, isStreaming, reloadChatTurns],
  );

  const handleEditUser = useCallback(
    async (turnId: string, newContent: string) => {
      if (isStreaming) return;
      let shouldReloadAfterStream = false;
      let hasStreamError = false;

      const idx = messages.findIndex((message) => message.id === turnId);
      if (idx < 0) return;

      const tempAssistantId = `assistant-edit-${Date.now()}`;
      let resolvedAssistantMessageId = tempAssistantId;
      let resolvedAssistantCandidateId: string | undefined;

      setMessages((prev) => {
        const next = prev.slice(0, idx + 1).map((message) => {
          if (message.id !== turnId) return message;
          const nextCount = Math.min(10, (message.candidateCount ?? 1) + 1);
          return {
            ...message,
            content: newContent,
            candidateNo: nextCount,
            candidateCount: nextCount,
          };
        });
        next.push({
          id: tempAssistantId,
          role: "assistant",
          content: "",
          isTemp: true,
          messageStreamStatus: "streaming",
          sentenceCardStatus: "idle",
          sentenceCardErrorCode: null,
        });
        return next;
      });
      setCurrentReplySuggestions(null);

      const controller = beginStream();
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
            onDone: async (fullContent) => {
              if (controller.signal.aborted) return;
              shouldReloadAfterStream = true;
              setMessages((prev) =>
                prev.map((message) =>
                  message.id === tempAssistantId ||
                  message.id === resolvedAssistantMessageId
                    ? {
                        ...message,
                        id: resolvedAssistantMessageId,
                        content: fullContent,
                        isTemp: false,
                        assistantCandidateId:
                          resolvedAssistantCandidateId ?? message.assistantCandidateId,
                        messageStreamStatus: "done",
                      }
                    : message,
                ),
              );
              setIsStreaming(false);
              clearActiveStream(controller);
            },
            onReplySuggestions: (suggestions) => {
              if (controller.signal.aborted) return;
              if (suggestions && suggestions.length > 0) {
                setCurrentReplySuggestions(suggestions);
              }
            },
            onSentenceCardStarted: (data) => {
              if (controller.signal.aborted) return;
              setMessages((prev) =>
                prev.map((message) =>
                  message.id === tempAssistantId ||
                  message.id === resolvedAssistantMessageId ||
                  message.assistantCandidateId === data.assistant_candidate_id
                    ? {
                        ...message,
                        sentenceCardStatus: "loading",
                        sentenceCardErrorCode: null,
                      }
                    : message,
                ),
              );
            },
            onSentenceCard: (data) => {
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
                        sentenceCard: data.sentence_card,
                        sentenceCardStatus: "ready",
                        sentenceCardErrorCode: null,
                      }
                    : message,
                ),
              );
            },
            onSentenceCardError: (data) => {
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
                        sentenceCardStatus: "error",
                        sentenceCardErrorCode: data.code,
                      }
                    : message,
                ),
              );
            },
            onError: async (errMsg) => {
              if (controller.signal.aborted) return;
              hasStreamError = true;
              setMessages((prev) =>
                prev.map((message) =>
                  message.id === tempAssistantId ||
                  message.id === resolvedAssistantMessageId
                    ? {
                        ...message,
                        id: resolvedAssistantMessageId,
                        content: `Error: ${errMsg}`,
                        messageStreamStatus: "error",
                        sentenceCardStatus:
                          deriveSentenceCardStatus(message) === "loading"
                            ? "idle"
                            : message.sentenceCardStatus,
                      }
                    : message,
                ),
              );
              setIsStreaming(false);
              clearActiveStream(controller);
            },
          },
        );
        if (
          !controller.signal.aborted &&
          (shouldReloadAfterStream || hasStreamError)
        ) {
          await reloadChatTurns();
        }
      } finally {
        clearActiveStream(controller);
      }
    },
    [beginStream, clearActiveStream, isStreaming, messages, reloadChatTurns],
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

      setCurrentReplySuggestions(null);

      setMessages((prev) => [
        ...prev,
        {
          id: tempAssistantId,
          role: "assistant",
          content: "",
          isTemp: true,
          messageStreamStatus: "streaming",
          sentenceCardStatus: "idle",
          sentenceCardErrorCode: null,
        },
      ]);

      const controller = beginStream();
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
                      sentenceCardStatus: "idle",
                      sentenceCardErrorCode: null,
                    };
                  }

                  return message;
                }),
              );
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
              clearActiveStream(controller);
            },
            onReplySuggestions: (suggestions) => {
              if (controller.signal.aborted) return;
              if (suggestions && suggestions.length > 0) {
                setCurrentReplySuggestions((prev) => {
                  const existing = prev ?? [];
                  return [...existing, ...suggestions];
                });
              }
            },
            onSentenceCardStarted: (data) => {
              if (controller.signal.aborted) return;
              setMessages((prev) =>
                prev.map((message) =>
                  message.id === tempAssistantId ||
                  message.id === resolvedAssistantMessageId ||
                  message.assistantCandidateId === data.assistant_candidate_id
                    ? {
                        ...message,
                        sentenceCardStatus: "loading",
                        sentenceCardErrorCode: null,
                      }
                    : message,
                ),
              );
            },
            onSentenceCard: (data) => {
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
                        sentenceCard: data.sentence_card,
                        sentenceCardStatus: "ready",
                        sentenceCardErrorCode: null,
                      }
                    : message,
                ),
              );
            },
            onSentenceCardError: (data) => {
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
                        sentenceCardStatus: "error",
                        sentenceCardErrorCode: data.code,
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
            onError: async (streamError) => {
              if (controller.signal.aborted) return;
              hasStreamError = true;
              console.error("Chat error:", streamError);
              setMessages((prev) =>
                prev.map((message) =>
                  message.id === tempAssistantId ||
                  message.id === resolvedAssistantMessageId
                    ? {
                        ...message,
                        content: `Error: ${streamError}`,
                        messageStreamStatus: "error",
                        sentenceCardStatus:
                          deriveSentenceCardStatus(message) === "loading"
                            ? "idle"
                            : message.sentenceCardStatus,
                      }
                    : message,
                ),
              );
              setIsStreaming(false);
              clearActiveStream(controller);
              await reloadChatTurns();
            },
          },
        );

        if (
          !controller.signal.aborted &&
          shouldReloadAfterStream &&
          !hasStreamError
        ) {
          await reloadChatTurns();
        }
      } finally {
        clearActiveStream(controller);
      }
    },
    [
      beginStream,
      canSend,
      character,
      chatId,
      clearActiveStream,
      isStreaming,
      reloadChatTurns,
      ttsPlaybackManager,
    ],
  );

  const interruptAllTts = useCallback(() => {
    ttsPlaybackManager?.interruptAll();
  }, [ttsPlaybackManager]);

  const interruptStream = useCallback(() => {
    streamAbortRef.current?.abort();
    streamAbortRef.current = null;
    setIsStreaming(false);
    setMessages((prev) => prev.filter((msg) => msg.role === "user" || !msg.isTemp));
  }, []);

  return {
    character,
    messages,
    isStreaming,
    isLoading,
    error,
    currentReplySuggestions,
    clearReplySuggestions,
    characterId: characterIdRef.current,
    handleSelectCandidate,
    handleRegenAssistant,
    handleEditUser,
    handleRetrySentenceCard,
    handleSendMessage,
    interruptAllTts,
    interruptStream,
  };
}
