"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { useUserSettings } from "@/lib/user-settings-context";
import type { Message } from "@/components/ChatMessage";
import ChatHeader from "@/components/ChatHeader";
import ChatInput from "@/components/ChatInput";
import ChatHistorySidebar from "@/components/chat/ChatHistorySidebar";
import ChatMainFrame from "@/components/layout/ChatMainFrame";
import ChatThread from "@/components/chat/ChatThread";
import LearningAssistantDialog from "@/components/LearningAssistantDialog";
import { useSidebar } from "../../layout";
import { useChatSession } from "@/hooks/useChatSession";
import { TtsPlaybackManager } from "@/lib/voice/tts-playback-manager";
import MessageNavigator from "@/components/chat/MessageNavigator";
import {
    ApiError,
    createChatInstance,
    deleteChat,
    getRealtimeIceConfig,
    updateChat,
    type ChatResponse,
    type LearningAssistantContextMessage,
    type RealtimeIceConfigResponse,
} from "@/lib/api";
import { useGrowth } from "@/lib/growth-context";
import ShareCardDialog from "@/components/growth/ShareCardDialog";
import { useRealtimeVoiceSession } from "@/hooks/useRealtimeVoiceSession";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ERROR_MESSAGE_MAP } from "@/lib/error-map";
import {
    getRealtimeIceConfigCacheMs,
    queryKeys,
    realtimeIceConfigQueryOptions,
    recentChatQueryOptions,
} from "@/lib/query";

const LEARNING_ASSISTANT_CONTEXT_LIMIT = 20;
const OLDER_MESSAGES_ROOT_MARGIN = "24px 0px 0px 0px";
const CHAT_TURN_SELECTOR = "[data-turn-id]";
const REALTIME_TURNS_RELOAD_DEBOUNCE_MS = 500;

interface ReloadChatTurnsOptions {
    requiredTurnIds?: Array<string | null | undefined>;
}

interface OlderMessagesRestoreSnapshot {
    previousScrollTop: number;
    previousScrollHeight: number;
    anchorId: string | null;
    anchorTop: number;
}

function buildLearningAssistantContext(
    messages: Message[],
): LearningAssistantContextMessage[] {
    const context: LearningAssistantContextMessage[] = [];

    for (let index = messages.length - 1; index >= 0; index -= 1) {
        if (context.length >= LEARNING_ASSISTANT_CONTEXT_LIMIT) {
            break;
        }

        const message = messages[index];
        if (message.isTemp || (message.role !== "user" && message.role !== "assistant")) {
            continue;
        }

        const content = message.content.trim();
        if (!content) {
            continue;
        }

        context.push({
            role: message.role,
            content,
        });
    }

    context.reverse();
    return context;
}

export default function ChatPage() {
    const params = useParams();
    const router = useRouter();
    const queryClient = useQueryClient();
    const { user, isAuthed } = useAuth();
    const { autoReadAloudEnabled } = useUserSettings();
    const {
        isSidebarOpen,
        toggleSidebar,
        refreshSidebarCharacters,
        setSelectedCharacterId,
    } = useSidebar();
    const chatId = params.id as string;

    // Phase 2: TTS playback manager
    const ttsManagerRef = useRef<TtsPlaybackManager | null>(null);
    const [playingCandidateId, setPlayingCandidateId] = useState<string | null>(null);
    const [ttsLoadingCandidateId, setTtsLoadingCandidateId] = useState<string | null>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [isAssistantOpen, setIsAssistantOpen] = useState(false);
    const [micDialogMessage, setMicDialogMessage] = useState<string | null>(null);

    useEffect(() => {
        const manager = new TtsPlaybackManager();
        manager.onPlayStateChange = (candidateId) => {
            setPlayingCandidateId(candidateId);
            if (candidateId !== null) {
                setTtsLoadingCandidateId(null);
            }
        };
        manager.onAudioReady = () => {};
        ttsManagerRef.current = manager;

        return () => {
            manager.dispose();
            ttsManagerRef.current = null;
        };
    }, []);

    const { updateTodaySummary, enqueueShareCard, invalidateGrowthChatHeader } = useGrowth();
    const shouldAutoScrollRef = useRef(true);
    const lastScrollTopRef = useRef(0);

    const handleGrowthDailyRefresh = useCallback(
        () => invalidateGrowthChatHeader(user?.id ?? "", chatId),
        [invalidateGrowthChatHeader, user?.id, chatId],
    );

    const {
        chat,
        character,
        messages,
        isStreaming,
        isLoading,
        error,
        currentReplySuggestions,
        characterId,
        setCurrentChatTitle,
        handleSelectCandidate,
        handleRegenAssistant,
        handleContinue,
        handleEditUser,
        handleRetryReplyCard,
        handleSendMessage: originalHandleSendMessage,
        handleRetrySend,
        interruptStream,
        loadOlderMessages,
        hasOlderMessages,
        isLoadingOlder,
        reloadChatTurns,
    } = useChatSession({
        chatId,
        isAuthed,
        canSend: Boolean(user),
        setSelectedCharacterId,
        ttsPlaybackManager: ttsManagerRef.current,
        autoReadAloudEnabled,
        onGrowthDailyUpdated: updateTodaySummary,
        onGrowthDailyRefresh: handleGrowthDailyRefresh,
        onGrowthShareCardReady: enqueueShareCard,
    });

    const realtimeReloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const realtimeReloadInFlightRef = useRef<Promise<void> | null>(null);
    const pendingRealtimeTurnIdsRef = useRef<Set<string>>(new Set());

    useEffect(() => {
        if (!isAuthed || !user?.id) {
            return;
        }

        void queryClient.prefetchQuery(realtimeIceConfigQueryOptions(user.id));
    }, [isAuthed, queryClient, user?.id]);

    const flushRealtimeChatTurnsReload = useCallback(async (options?: { force?: boolean }) => {
        if (realtimeReloadTimerRef.current) {
            clearTimeout(realtimeReloadTimerRef.current);
            realtimeReloadTimerRef.current = null;
        }

        let shouldForceReload = options?.force ?? false;

        while (true) {
            if (realtimeReloadInFlightRef.current) {
                await realtimeReloadInFlightRef.current;
                continue;
            }

            const requiredTurnIds = Array.from(pendingRealtimeTurnIdsRef.current);
            pendingRealtimeTurnIdsRef.current.clear();

            if (!shouldForceReload && requiredTurnIds.length === 0) {
                return;
            }

            const reloadOptions: ReloadChatTurnsOptions | undefined = requiredTurnIds.length
                ? { requiredTurnIds }
                : undefined;

            const promise = reloadChatTurns(reloadOptions).finally(() => {
                realtimeReloadInFlightRef.current = null;
            });

            realtimeReloadInFlightRef.current = promise;
            shouldForceReload = false;
            await promise;

            if (pendingRealtimeTurnIdsRef.current.size === 0) {
                return;
            }
        }
    }, [reloadChatTurns]);

    const scheduleRealtimeChatTurnsReload = useCallback((options?: ReloadChatTurnsOptions) => {
        options?.requiredTurnIds?.forEach((turnId) => {
            if (turnId) {
                pendingRealtimeTurnIdsRef.current.add(turnId);
            }
        });

        if (realtimeReloadTimerRef.current) {
            clearTimeout(realtimeReloadTimerRef.current);
        }

        realtimeReloadTimerRef.current = setTimeout(() => {
            realtimeReloadTimerRef.current = null;
            void flushRealtimeChatTurnsReload().catch((err) => {
                console.error("Failed to refresh realtime chat turns:", err);
            });
        }, REALTIME_TURNS_RELOAD_DEBOUNCE_MS);
    }, [flushRealtimeChatTurnsReload]);

    useEffect(() => {
        const pendingRealtimeTurnIds = pendingRealtimeTurnIdsRef.current;

        return () => {
            if (realtimeReloadTimerRef.current) {
                clearTimeout(realtimeReloadTimerRef.current);
                realtimeReloadTimerRef.current = null;
            }
            pendingRealtimeTurnIds.clear();
        };
    }, [chatId]);

    const getIceConfigForRealtimeCall = useCallback(async (signal?: AbortSignal) => {
        if (signal?.aborted) {
            throw new DOMException("The operation was aborted.", "AbortError");
        }

        const queryKey = queryKeys.realtime.iceConfig(user?.id);
        const cached = queryClient.getQueryData<RealtimeIceConfigResponse>(queryKey);
        const state = queryClient.getQueryState(queryKey);

        if (cached && state?.dataUpdatedAt) {
            const maxAgeMs = getRealtimeIceConfigCacheMs(cached);
            if (maxAgeMs > 0 && Date.now() - state.dataUpdatedAt < maxAgeMs) {
                return cached;
            }
        }

        const fetched = await getRealtimeIceConfig({ signal });
        queryClient.setQueryData(queryKey, fetched);
        return fetched;
    }, [queryClient, user?.id]);

    const realtimeSession = useRealtimeVoiceSession({
        chatId,
        characterId: character?.id ?? null,
        translationEnabled: true,
        getIceConfig: getIceConfigForRealtimeCall,
        onSessionEnded: async () => {
            await flushRealtimeChatTurnsReload({ force: true });
            void refreshSidebarCharacters().catch((err) => {
                console.error("Failed to refresh sidebar after realtime session:", err);
            });
        },
        onConversationEvent: (event) => {
            if (event.chat_id !== chatId) {
                return;
            }

            if (event.type === "conversation.turn.updated" && event.is_final) {
                scheduleRealtimeChatTurnsReload({
                    requiredTurnIds: [event.assistant_turn_id],
                });
                return;
            }
            if (event.type === "conversation.turn.failed") {
                scheduleRealtimeChatTurnsReload({
                    requiredTurnIds: [event.assistant_turn_id],
                });
                return;
            }
        },
    });

    const displayMessages = useMemo(() => {
      if (!realtimeSession.isConnected) return messages;

      const result: Message[] = [...messages];
      const { subtitles } = realtimeSession;

      const userRaw = subtitles.userRaw.trim();
      if (userRaw) {
        const lastRealUser = [...messages].reverse().find(m => m.role === "user" && !m.isTemp);
        if (!lastRealUser || lastRealUser.content !== userRaw) {
          result.push({
            id: "__realtime_user_subtitle__",
            role: "user",
            content: userRaw,
            isTemp: true,
          });
        }
      }

      const assistantRaw = subtitles.assistantRaw.trim();
      if (assistantRaw) {
        const lastRealAssistant = [...messages].reverse().find(m => m.role === "assistant" && !m.isTemp);
        if (!lastRealAssistant || lastRealAssistant.content !== assistantRaw) {
          result.push({
            id: "__realtime_assistant_subtitle__",
            role: "assistant",
            content: assistantRaw,
            isTemp: true,
            messageStreamStatus: realtimeSession.isBotSpeaking ? "streaming" : "done",
          });
        }
      }

      return result;
    }, [messages, realtimeSession.isConnected, realtimeSession.subtitles.userRaw,
        realtimeSession.subtitles.assistantRaw, realtimeSession.isBotSpeaking]);

    const isConversationReadOnly = character?.status === "UNPUBLISHED";
    const readOnlyNotice = isConversationReadOnly
        ? "该角色已被作者下架，当前聊天仅支持查看历史记录。"
        : null;
    const learningAssistantContext = buildLearningAssistantContext(messages);

    const handleCreateNewChat = useCallback(async () => {
        if (!characterId || isStreaming || isConversationReadOnly) {
            return;
        }

        const created = await createChatInstance({ character_id: characterId });
        queryClient.setQueryData(
            queryKeys.chats.recent(user?.id, characterId),
            {
                chat: created.chat,
                character: created.character,
            },
        );
        await Promise.all([
            queryClient.invalidateQueries({
                queryKey: queryKeys.chats.history(user?.id, characterId),
            }),
            queryClient.invalidateQueries({
                queryKey: queryKeys.sidebar.characters(user?.id),
            }),
        ]);
        router.push(`/chat/${created.chat.id}`);
    }, [
        characterId,
        isConversationReadOnly,
        isStreaming,
        queryClient,
        router,
        user?.id,
    ]);

    const handleSendMessage = useCallback(
        async (content: string) => {
            shouldAutoScrollRef.current = true;
            if (realtimeSession.isConnected && realtimeSession.isBotSpeaking) {
                await realtimeSession.interruptAssistant();
            }
            await originalHandleSendMessage(content);
            void refreshSidebarCharacters().catch((err) => {
                console.error("Failed to refresh sidebar characters:", err);
            });
        },
        [originalHandleSendMessage, realtimeSession, refreshSidebarCharacters],
    );

    const wrappedHandleContinue = useCallback(
        async () => {
            shouldAutoScrollRef.current = true;
            await handleContinue();
            void refreshSidebarCharacters().catch((err) => {
                console.error("Failed to refresh sidebar characters:", err);
            });
        },
        [handleContinue, refreshSidebarCharacters],
    );

    const handleSelectHistoryChat = useCallback(
        (targetChatId: string) => {
            if (targetChatId === chatId) {
                setIsHistoryOpen(false);
                return;
            }

            router.push(`/chat/${targetChatId}`);
            setIsHistoryOpen(false);
        },
        [chatId, router],
    );

    const handleRenameChat = useCallback(
        async (targetChatId: string, title: string): Promise<ChatResponse> => {
            const updated = await updateChat(targetChatId, { title });
            if (targetChatId === chatId) {
                setCurrentChatTitle(updated.title);
            }
            await Promise.all([
                queryClient.invalidateQueries({
                    queryKey: queryKeys.chats.history(user?.id, characterId),
                }),
                queryClient.invalidateQueries({
                    queryKey: queryKeys.sidebar.characters(user?.id),
                }),
            ]);
            return updated;
        },
        [chatId, characterId, queryClient, setCurrentChatTitle, user?.id],
    );

    const handleDeleteHistoryChat = useCallback(async (targetChatId: string) => {
        if (!characterId) {
            return;
        }

        await deleteChat(targetChatId);
        await Promise.all([
            queryClient.invalidateQueries({
                queryKey: queryKeys.chats.history(user?.id, characterId),
            }),
            queryClient.invalidateQueries({
                queryKey: queryKeys.sidebar.characters(user?.id),
            }),
        ]);

        if (targetChatId !== chatId) {
            return;
        }

        queryClient.removeQueries({
            queryKey: queryKeys.chats.recent(user?.id, characterId),
        });
        const recent = await queryClient.fetchQuery(
            recentChatQueryOptions(user?.id, characterId),
        );
        if (recent?.chat?.id && recent.chat.id !== targetChatId) {
            router.push(`/chat/${recent.chat.id}`);
        } else {
            if (character?.status === "UNPUBLISHED") {
                router.push("/");
            } else {
                try {
                    const created = await createChatInstance({ character_id: characterId });
                    queryClient.setQueryData(
                        queryKeys.chats.recent(user?.id, characterId),
                        {
                            chat: created.chat,
                            character: created.character,
                        },
                    );
                    router.push(`/chat/${created.chat.id}`);
                } catch (err) {
                    if (err instanceof ApiError && err.code === "resource_conflict") {
                        router.push("/");
                        return;
                    }
                    throw err;
                }
            }
        }

    }, [character?.status, characterId, chatId, queryClient, router, user?.id]);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const messagesStartRef = useRef<HTMLDivElement | null>(null);
    const scrollRootRef = useRef<HTMLDivElement>(null);
    const isLoadingOlderRef = useRef(false);
    const olderMessagesRestoreRef = useRef<OlderMessagesRestoreSnapshot | null>(null);
    const [olderRestoreRevision, setOlderRestoreRevision] = useState(0);

    // Reset on chat switch
    useEffect(() => {
        shouldAutoScrollRef.current = true;
        isLoadingOlderRef.current = false;
        olderMessagesRestoreRef.current = null;
    }, [chatId]);

    useEffect(() => {
        isLoadingOlderRef.current = isLoadingOlder;
    }, [isLoadingOlder]);

    const getViewportStart = useCallback((root: HTMLDivElement) => {
        const headerHeightValue = window
            .getComputedStyle(root)
            .getPropertyValue("--header-height")
            .trim();
        const headerHeight = Number.parseFloat(headerHeightValue);
        return root.getBoundingClientRect().top + (Number.isFinite(headerHeight) ? headerHeight : 0);
    }, []);

    const captureOlderMessagesSnapshot = useCallback((root: HTMLDivElement): OlderMessagesRestoreSnapshot => {
        const viewportStart = getViewportStart(root);
        const messageElements = Array.from(
            root.querySelectorAll<HTMLElement>(CHAT_TURN_SELECTOR),
        );
        const anchorElement = messageElements.find(
            (element) => element.getBoundingClientRect().bottom > viewportStart,
        ) ?? messageElements[0] ?? null;

        return {
            previousScrollTop: root.scrollTop,
            previousScrollHeight: root.scrollHeight,
            anchorId: anchorElement?.dataset.turnId ?? null,
            anchorTop: anchorElement
                ? anchorElement.getBoundingClientRect().top - viewportStart
                : 0,
        };
    }, [getViewportStart]);

    const restoreOlderMessagesViewport = useCallback(() => {
        const root = scrollRootRef.current;
        const snapshot = olderMessagesRestoreRef.current;
        olderMessagesRestoreRef.current = null;

        if (!root || !snapshot) {
            return;
        }

        let nextScrollTop: number | null = null;

        if (snapshot.anchorId) {
            const anchorElement = root.querySelector<HTMLElement>(
                `[data-turn-id="${snapshot.anchorId}"]`,
            );
            if (anchorElement) {
                const viewportStart = getViewportStart(root);
                const currentAnchorTop = anchorElement.getBoundingClientRect().top - viewportStart;
                nextScrollTop = root.scrollTop + (currentAnchorTop - snapshot.anchorTop);
            }
        }

        if (nextScrollTop === null) {
            const scrollDelta = root.scrollHeight - snapshot.previousScrollHeight;
            nextScrollTop = snapshot.previousScrollTop + scrollDelta;
        }

        root.scrollTop = Math.max(nextScrollTop, 0);
        lastScrollTopRef.current = root.scrollTop;
    }, [getViewportStart]);

    const loadOlderMessagesPreservingViewport = useCallback(async () => {
        const root = scrollRootRef.current;
        if (!root || isLoadingOlderRef.current) return;

        isLoadingOlderRef.current = true;
        olderMessagesRestoreRef.current = captureOlderMessagesSnapshot(root);

        try {
            await loadOlderMessages();
        } finally {
            setOlderRestoreRevision((previous) => previous + 1);
        }
    }, [captureOlderMessagesSnapshot, loadOlderMessages]);

    useLayoutEffect(() => {
        if (olderRestoreRevision === 0) {
            return;
        }
        if (!olderMessagesRestoreRef.current) {
            return;
        }
        if (isLoadingOlder) {
            return;
        }

        restoreOlderMessagesViewport();
        isLoadingOlderRef.current = false;
    }, [isLoadingOlder, messages, olderRestoreRevision, restoreOlderMessagesViewport]);

    // Read-only scroll listener: detect direction and near-bottom for auto-follow.
    useEffect(() => {
        const root = scrollRootRef.current;
        if (!root) return;

        lastScrollTopRef.current = root.scrollTop;

        const onScroll = () => {
            const currentScrollTop = root.scrollTop;
            const distanceToBottom = root.scrollHeight - currentScrollTop - root.clientHeight;

            if (currentScrollTop < lastScrollTopRef.current) {
                shouldAutoScrollRef.current = false;
            } else if (distanceToBottom <= 5) {
                shouldAutoScrollRef.current = true;
            }

            lastScrollTopRef.current = currentScrollTop;
        };

        root.addEventListener("scroll", onScroll, { passive: true });
        return () => {
            root.removeEventListener("scroll", onScroll);
        };
    }, []);

    useEffect(() => {
        const root = scrollRootRef.current;
        const sentinel = messagesStartRef.current;
        if (!root || !sentinel) return;

        const observer = new IntersectionObserver(
            (entries) => {
                const [entry] = entries;
                if (
                    entry.isIntersecting &&
                    !isLoading &&
                    hasOlderMessages &&
                    !isLoadingOlderRef.current
                ) {
                    void loadOlderMessagesPreservingViewport();
                }
            },
            {
                root: root,
                rootMargin: OLDER_MESSAGES_ROOT_MARGIN,
                threshold: 0,
            },
        );

        observer.observe(sentinel);

        return () => observer.disconnect();
    }, [hasOlderMessages, isLoading, loadOlderMessagesPreservingViewport]);

    const pinToBottom = useCallback(() => {
        const root = scrollRootRef.current;
        if (!root) return;
        root.scrollTop = root.scrollHeight;
    }, []);

    // Pin to bottom on content changes (new messages, streaming).
    // Uses useLayoutEffect so the scroll adjustment happens before the browser
    // paints — the user never sees an intermediate non-bottom state.
    useLayoutEffect(() => {
        if (!shouldAutoScrollRef.current) return;
        pinToBottom();
    }, [chatId, displayMessages, isStreaming, pinToBottom]);

    // Keep the view pinned to the bottom while content is still settling
    // (e.g. images loading) and when the scroll container resizes
    // (e.g. composer height changes).
    useEffect(() => {
        const root = scrollRootRef.current;
        if (!root) return;

        const main = root.querySelector("main");

        const observer = new ResizeObserver(() => {
            if (!shouldAutoScrollRef.current) return;
            pinToBottom();
        });

        if (main) {
            observer.observe(main);
        }
        observer.observe(root);

        return () => observer.disconnect();
    }, [pinToBottom]);

    // Phase 2: Mic start → interrupt TTS + track recording state
    const handleMicStart = useCallback(() => {
        setIsRecording(true);
        ttsManagerRef.current?.interruptAll();
    }, []);

    const handleMicCancel = useCallback(() => {
        setIsRecording(false);
    }, []);


    // Phase 2: Speaker button handlers
    const handlePlayTts = useCallback(async (candidateId: string) => {
        if (isRecording) return;
        setTtsLoadingCandidateId(candidateId);
        try {
            await ttsManagerRef.current?.playMessage(candidateId);
        } catch (err) {
            console.error("TTS playback failed:", err);
            setTtsLoadingCandidateId(null);
        }
    }, [isRecording]);

    const handleStopTts = useCallback((candidateId: string) => {
        ttsManagerRef.current?.stopMessage(candidateId);
        setTtsLoadingCandidateId(null);
    }, []);

    const headerContent = (
        <div className="w-full">
            <ChatHeader
                character={character}
                chatId={chatId}
                onNewChat={() => void handleCreateNewChat()}
                onToggleAssistant={() => setIsAssistantOpen((previous) => !previous)}
                isAssistantOpen={isAssistantOpen}
                onToggleHistory={() => setIsHistoryOpen((previous) => !previous)}
                isHistoryOpen={isHistoryOpen}
                isNewChatDisabled={!characterId || isStreaming || isConversationReadOnly}
                isReadOnly={isConversationReadOnly}
                onToggleSidebar={toggleSidebar}
            />
        </div>
    );

    const handleStartRealtimeCall = useCallback(() => {
        if (!character?.id || isConversationReadOnly) return;
        if (isStreaming) {
            interruptStream();
        }
        ttsManagerRef.current?.interruptAll();
        realtimeSession.clearMicError();
        setMicDialogMessage(null);
        void realtimeSession.startCall();
    }, [character?.id, interruptStream, isConversationReadOnly, isStreaming, realtimeSession]);

    const handleCancelRealtimeConnect = useCallback(() => {
        void realtimeSession.cancelStart();
    }, [realtimeSession]);

    const handleEndRealtimeCall = useCallback(() => {
        void realtimeSession.endCall();
    }, [realtimeSession]);

    useEffect(() => {
        if (!realtimeSession.isConnected || !realtimeSession.isUserSpeaking) return;
        interruptStream();
        ttsManagerRef.current?.interruptAll();
    }, [interruptStream, realtimeSession.isConnected, realtimeSession.isUserSpeaking]);

    useEffect(() => {
        const code = realtimeSession.micErrorCode;
        if (!code) return;

        const message =
            code === "MIC_PERMISSION_DENIED"
                ? realtimeSession.micPermissionAction === "settings"
                    ? "请在浏览器或系统设置中允许使用麦克风后重试"
                    : "请允许麦克风权限以开始实时通话"
                : ERROR_MESSAGE_MAP[code]?.message ?? "无法启动实时通话";

        setMicDialogMessage(message);
    }, [realtimeSession.micErrorCode, realtimeSession.micPermissionAction]);

    useEffect(() => {
        if (!realtimeSession.lastError) return;
        setMicDialogMessage(realtimeSession.lastError);
    }, [realtimeSession.lastError]);

    const voiceButtonState = realtimeSession.isConnecting
        ? "connecting"
        : realtimeSession.isConnected
        ? realtimeSession.isUserSpeaking
            ? "active_user_speaking"
            : "active_ready"
        : "idle";

    const micCaptureState = realtimeSession.isConnected
        ? realtimeSession.isMicCaptureEnabled
            ? "mic_hot"
            : "mic_cold"
        : "hidden";

    const threadContent = (
        <>
            <audio ref={realtimeSession.audioRef} className="hidden" autoPlay playsInline />
            <AlertDialog
                open={!!micDialogMessage}
                onOpenChange={(open) => {
                    if (!open) {
                        realtimeSession.clearMicError();
                        setMicDialogMessage(null);
                    }
                }}
            >
                <AlertDialogContent className="max-w-md rounded-2xl p-6">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-xl font-bold text-gray-900">
                            无法开始实时通话
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-gray-600">
                            {micDialogMessage}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogAction
                            onClick={() => {
                                realtimeSession.clearMicError();
                                setMicDialogMessage(null);
                            }}
                            className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
                        >
                            知道了
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            <ChatThread
                character={character}
                messages={displayMessages}
                isLoading={isLoading}
                error={error}
                isStreaming={isStreaming}
                userAvatar={user?.avatar_urls?.md || "/default-avatar.svg"}
                messagesEndRef={messagesEndRef}
                messagesStartRef={messagesStartRef}
                chatId={chatId}
                onSelectCandidate={handleSelectCandidate}
                onRegenAssistant={handleRegenAssistant}
                onRetrySend={handleRetrySend}
                onEditUser={handleEditUser}
                onRetryReplyCard={handleRetryReplyCard}
                playingCandidateId={playingCandidateId}
                ttsLoadingCandidateId={ttsLoadingCandidateId}
                isRecording={isRecording}
                onPlayTts={handlePlayTts}
                onStopTts={handleStopTts}
                isLoadingOlder={isLoadingOlder}
                isConversationLocked={isConversationReadOnly}
                messageActionProfile={realtimeSession.isConnected ? "voice-active" : "text"}
            />
            <MessageNavigator
                messages={messages}
                scrollRootRef={scrollRootRef}
                isSidebarOpen={isSidebarOpen}
            />
        </>
    );

    const composerContent = character && !error ? (
        isConversationReadOnly && readOnlyNotice ? (
            <div
                className="text-base mx-auto [--thread-content-margin:--spacing(4)] @w-sm/main:[--thread-content-margin:--spacing(6)] @w-lg/main:[--thread-content-margin:--spacing(16)] px-(--thread-content-margin)"
                style={{ backgroundColor: "var(--workspace-bg)" }}
            >
                <div
                    className="[--thread-content-max-width:40rem] @w-lg/main:[--thread-content-max-width:48rem] mx-auto max-w-(--thread-content-max-width) flex-1 mb-4"
                    style={{ maxWidth: "48rem", width: "100%" }}
                >
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                        {readOnlyNotice}
                    </div>
                </div>
            </div>
        ) : (
            <ChatInput
                onSend={handleSendMessage}
                isStreaming={isStreaming}
                onInterrupt={interruptStream}
                onContinue={wrappedHandleContinue}
                roleName={character.name}
                replySuggestions={realtimeSession.isConnected ? null : currentReplySuggestions}
                onMicStart={handleMicStart}
                onMicCancel={handleMicCancel}
                voiceButtonState={voiceButtonState}
                micCaptureState={micCaptureState}
                onStartRealtimeVoice={handleStartRealtimeCall}
                onCancelRealtimeVoiceStart={handleCancelRealtimeConnect}
                onStopRealtimeVoice={handleEndRealtimeCall}
                onToggleMicCapture={realtimeSession.toggleMicCapture}
                getRealtimeMicAnalyserNode={realtimeSession.getMicAnalyserNode}
            />
        )
    ) : (
        <div className="text-base mx-auto px-4 sm:px-6 lg:px-16">
            <div className="mx-auto mb-4 w-full max-w-[768px]">
                <div
                    className="h-14 w-full"
                    style={{
                        borderRadius: "28px",
                        backgroundColor: "var(--bg-primary)",
                        boxShadow: "0 1px 2px rgba(0, 0, 0, 0.12)",
                    }}
                />
            </div>
        </div>
    );

    return (
        <div className="relative flex min-h-0 min-w-0 flex-1">
            <ChatMainFrame
                scrollRootRef={scrollRootRef}
                header={headerContent}
                thread={threadContent}
                composer={composerContent}
            />

            <ChatHistorySidebar
                isOpen={isHistoryOpen}
                character={character}
                activeChatId={chatId}
                activeChatTitle={chat?.title ?? ""}
                onClose={() => setIsHistoryOpen(false)}
                onSelectChat={handleSelectHistoryChat}
                onRenameChat={handleRenameChat}
                onDeleteChat={handleDeleteHistoryChat}
            />

            <LearningAssistantDialog
                open={isAssistantOpen}
                onOpenChange={setIsAssistantOpen}
                chatContext={learningAssistantContext}
                chatId={chatId}
            />

            <ShareCardDialog />
        </div>
    );
}
