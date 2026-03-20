"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Message } from "@/components/ChatMessage";
import type { Character } from "@/components/Sidebar";
import type { ReplySuggestion } from "@/lib/api";
import {
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
  // Phase 2: TTS
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
  handleSendMessage: (content: string) => Promise<void>;
  interruptAllTts: () => void;
}

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
          (t) => t.author_type === "USER" || t.author_type === "CHARACTER",
        )
        .filter(
          (t) =>
            t.primary_candidate.is_final ||
            t.primary_candidate.content.trim() !== "",
        )
        .map((t) => ({
          id: t.id,
          role: t.author_type === "USER" ? "user" : "assistant",
          content: t.primary_candidate.content,
          isGreeting:
            t.author_type === "CHARACTER" &&
            t.is_proactive &&
            !t.parent_turn_id,
          candidateNo: t.primary_candidate.candidate_no,
          candidateCount: t.candidate_count,
          // Phase 1: learning data from candidate.extra
          inputTransform: t.primary_candidate.extra?.input_transform ?? null,
          sentenceCard: t.primary_candidate.extra?.sentence_card ?? null,
          assistantTurnId: t.author_type === "CHARACTER" ? t.id : undefined,
          assistantCandidateId:
            t.author_type === "CHARACTER" ? t.primary_candidate.id : undefined,
          knowledgeCardStatus:
            t.author_type === "CHARACTER"
              ? t.primary_candidate.extra?.sentence_card
                ? "ready"
                : "idle"
              : undefined,
        }));

      setMessages(mappedMessages);
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

  const handleRegenAssistant = useCallback(
    async (turnId: string) => {
      if (isStreaming) return;
      let shouldReloadAfterStream = false;
      let hasStreamError = false;

      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== turnId) return m;
          const nextCount = Math.min(10, (m.candidateCount ?? 1) + 1);
          return {
            ...m,
            content: "",
            candidateNo: nextCount,
            candidateCount: nextCount,
            sentenceCard: null,
            knowledgeCardStatus: "loading",
          };
        }),
      );
      setCurrentReplySuggestions(null);

      const controller = beginStream();
      setIsStreaming(true);

      try {
        await regenAssistantTurn(turnId, {
          signal: controller.signal,
          onChunk: (chunk) => {
            if (controller.signal.aborted) return;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === turnId
                  ? {
                      ...m,
                      content: m.content + chunk,
                      knowledgeCardStatus: "loading",
                    }
                  : m,
              ),
            );
          },
          onDone: async (fullContent) => {
            if (controller.signal.aborted) return;
            shouldReloadAfterStream = true;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === turnId
                  ? {
                      ...m,
                      content: fullContent,
                      knowledgeCardStatus: "loading",
                    }
                  : m,
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
          onError: async (errMsg) => {
            if (controller.signal.aborted) return;
            hasStreamError = true;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === turnId
                  ? {
                      ...m,
                      content: `Error: ${errMsg}`,
                      knowledgeCardStatus: "error",
                    }
                  : m,
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

      const idx = messages.findIndex((m) => m.id === turnId);
      if (idx < 0) return;

      const tempAssistantId = `assistant-edit-${Date.now()}`;

      setMessages((prev) => {
        const next = prev.slice(0, idx + 1).map((m) => {
          if (m.id !== turnId) return m;
          const nextCount = Math.min(10, (m.candidateCount ?? 1) + 1);
          return {
            ...m,
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
          knowledgeCardStatus: "loading",
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
            onChunk: (chunk) => {
              if (controller.signal.aborted) return;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === tempAssistantId
                    ? {
                        ...m,
                        content: m.content + chunk,
                        knowledgeCardStatus: "loading",
                      }
                    : m,
                ),
              );
            },
            onDone: async (fullContent) => {
              if (controller.signal.aborted) return;
              shouldReloadAfterStream = true;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === tempAssistantId
                    ? {
                        ...m,
                        content: fullContent,
                        knowledgeCardStatus: "loading",
                      }
                    : m,
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
            onError: async (errMsg) => {
              if (controller.signal.aborted) return;
              hasStreamError = true;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === tempAssistantId
                    ? {
                        ...m,
                        content: `Error: ${errMsg}`,
                        knowledgeCardStatus: "error",
                      }
                    : m,
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

      // Phase 2: Interrupt all TTS before sending
      ttsPlaybackManager?.interruptAll();
      // Ensure AudioContext is resumed within user gesture to allow auto read-aloud.
      void ttsPlaybackManager?.ensureResumed().catch(() => {});

      const tempUserId = `user-${Date.now()}`;
      const tempAssistantId = `assistant-${Date.now()}`;
      let resolvedUserMessageId = tempUserId;
      let resolvedAssistantMessageId = tempAssistantId;
      let shouldReloadAfterStream = false;
      let hasStreamError = false;

      // Immediately add user message
      const userMessage: Message = {
        id: tempUserId,
        role: "user",
        content,
        isTemp: true,
      };
      setMessages((prev) => [...prev, userMessage]);

      // Clear previous suggestions when new message is sent
      setCurrentReplySuggestions(null);

      // Add placeholder assistant message
      setMessages((prev) => [
        ...prev,
        {
          id: tempAssistantId,
          role: "assistant",
          content: "",
          isTemp: true,
          knowledgeCardStatus: "loading",
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

              setMessages((prev) =>
                prev.map((m) => {
                  if (m.id === tempUserId || m.id === resolvedUserMessageId) {
                    return {
                      ...m,
                      id: resolvedUserMessageId,
                      isTemp: false,
                      candidateNo: m.candidateNo ?? 1,
                      candidateCount: m.candidateCount ?? 1,
                    };
                  }

                  if (
                    m.id === tempAssistantId ||
                    m.id === resolvedAssistantMessageId
                  ) {
                    return {
                      ...m,
                      id: resolvedAssistantMessageId,
                      assistantTurnId: meta.assistant_turn.id,
                      assistantCandidateId: meta.assistant_turn.candidate_id,
                      candidateNo: m.candidateNo ?? 1,
                      candidateCount: m.candidateCount ?? 1,
                      knowledgeCardStatus: "loading",
                    };
                  }

                  return m;
                }),
              );
            },

            // Phase 1: Transform events (mixed-input translation)
            onTransformChunk: (chunk) => {
              if (controller.signal.aborted) return;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === tempUserId || m.id === resolvedUserMessageId
                    ? {
                        ...m,
                        transformChunks: (m.transformChunks || "") + chunk,
                      }
                    : m,
                ),
              );
            },
            onTransformDone: (data) => {
              if (controller.signal.aborted) return;
              if (data.applied) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === tempUserId || m.id === resolvedUserMessageId
                      ? {
                          ...m,
                          transformChunks: undefined,
                          inputTransform: {
                            applied: true,
                            transformed_content: data.transformed_content,
                          },
                        }
                      : m,
                  ),
                );
              } else {
                // Transform was not applied, clear streaming state
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === tempUserId || m.id === resolvedUserMessageId
                      ? { ...m, transformChunks: undefined }
                      : m,
                  ),
                );
              }
            },

            // Assistant streaming
            onChunk: (chunk) => {
              if (controller.signal.aborted) return;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === tempAssistantId ||
                  m.id === resolvedAssistantMessageId
                    ? {
                        ...m,
                        content: m.content + chunk,
                        isTemp: (m.content + chunk).trim().length === 0,
                        knowledgeCardStatus: "loading",
                      }
                    : m,
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

              setMessages((prev) =>
                prev.map((m) =>
                  m.id === tempAssistantId ||
                  m.id === resolvedAssistantMessageId
                    ? {
                        ...m,
                        id: resolvedAssistantMessageId,
                        content: fullContent,
                        assistantTurnId: assistantTurnId ?? m.assistantTurnId,
                        assistantCandidateId:
                          assistantCandidateId ?? m.assistantCandidateId,
                        isTemp: false,
                        candidateNo: m.candidateNo ?? 1,
                        candidateCount: m.candidateCount ?? 1,
                        knowledgeCardStatus: "loading",
                      }
                    : m,
                ),
              );
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === tempUserId || m.id === resolvedUserMessageId
                    ? {
                        ...m,
                        id: resolvedUserMessageId,
                        isTemp: false,
                        candidateNo: m.candidateNo ?? 1,
                        candidateCount: m.candidateCount ?? 1,
                      }
                    : m,
                ),
              );
              setIsStreaming(false);
              clearActiveStream(controller);
            },

            // Phase 1: Reply suggestions (streamed one at a time after done)
            onReplySuggestions: (suggestions) => {
              if (controller.signal.aborted) return;
              if (suggestions && suggestions.length > 0) {
                setCurrentReplySuggestions((prev) => {
                  const existing = prev ?? [];
                  return [...existing, ...suggestions];
                });
              }
            },

            // Phase 1: Sentence card
            onSentenceCard: (data) => {
              if (controller.signal.aborted) return;
              const targetAssistantId =
                data.message_id || resolvedAssistantMessageId;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === targetAssistantId ||
                  m.id === resolvedAssistantMessageId ||
                  m.id === tempAssistantId ||
                  m.assistantTurnId === targetAssistantId
                    ? {
                        ...m,
                        sentenceCard: data.sentence_card,
                        knowledgeCardStatus: "ready",
                      }
                    : m,
                ),
              );
            },

            // Phase 2: TTS realtime callbacks
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
                prev.map((m) =>
                  m.id === tempAssistantId ||
                  m.id === resolvedAssistantMessageId
                    ? {
                        ...m,
                        content: `Error: ${streamError}`,
                        knowledgeCardStatus: "error",
                      }
                    : m,
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
    handleSendMessage,
    interruptAllTts,
  };
}
