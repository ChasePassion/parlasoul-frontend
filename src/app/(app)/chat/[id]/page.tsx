"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useUserSettings } from "@/lib/user-settings-context";
import ChatHeader from "@/components/ChatHeader";
import ChatInput from "@/components/ChatInput";
import ChatMainFrame from "@/components/layout/ChatMainFrame";
import ChatThread from "@/components/chat/ChatThread";
import { useSidebar } from "../../layout";
import { useChatSession } from "@/hooks/useChatSession";
import { TtsPlaybackManager } from "@/lib/voice/tts-playback-manager";

export default function ChatPage() {
    const params = useParams();
    const { user, isAuthed } = useAuth();
    const { setSelectedCharacterId } = useSidebar();
    const { autoReadAloudEnabled } = useUserSettings();
    const chatId = params.id as string;

    // Phase 2: TTS playback manager
    const ttsManagerRef = useRef<TtsPlaybackManager | null>(null);
    const [playingCandidateId, setPlayingCandidateId] = useState<string | null>(null);
    const [ttsLoadingCandidateId, setTtsLoadingCandidateId] = useState<string | null>(null);
    const [isRecording, setIsRecording] = useState(false);

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

    const {
        character,
        messages,
        isStreaming,
        isLoading,
        error,
        currentReplySuggestions,
        handleSelectCandidate,
        handleRegenAssistant,
        handleEditUser,
        handleRetryReplyCard,
        handleSendMessage,
        interruptStream,
        loadOlderMessages,
        hasOlderMessages,
        isLoadingOlder,
    } = useChatSession({
        chatId,
        isAuthed,
        canSend: Boolean(user),
        setSelectedCharacterId,
        ttsPlaybackManager: ttsManagerRef.current,
        autoReadAloudEnabled,
    });

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const messagesStartRef = useRef<HTMLDivElement | null>(null);
    const scrollRootRef = useRef<HTMLDivElement>(null);
    const shouldAutoScrollRef = useRef(true);

    useEffect(() => {
        const root = scrollRootRef.current;
        if (!root) return;

        const updateShouldAutoScroll = () => {
            const distanceToBottom = root.scrollHeight - root.scrollTop - root.clientHeight;
            shouldAutoScrollRef.current = distanceToBottom <= 160;
        };

        updateShouldAutoScroll();
        root.addEventListener("scroll", updateShouldAutoScroll, { passive: true });

        return () => {
            root.removeEventListener("scroll", updateShouldAutoScroll);
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
                    !isLoadingOlder
                ) {
                    loadOlderMessages();
                }
            },
            {
                root: root,
                rootMargin: "200px",
                threshold: 0,
            },
        );

        observer.observe(sentinel);

        return () => observer.disconnect();
    }, [isLoading, hasOlderMessages, isLoadingOlder, loadOlderMessages]);

    useEffect(() => {
        if (!shouldAutoScrollRef.current) return;
        const raf = requestAnimationFrame(() => {
            messagesEndRef.current?.scrollIntoView({
                behavior: isStreaming ? "auto" : "smooth",
                block: "end",
            });
        });
        return () => cancelAnimationFrame(raf);
    }, [messages, isStreaming]);

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
            <ChatHeader character={character} />
        </div>
    );

    const threadContent = (
        <ChatThread
            character={character}
            messages={messages}
            isLoading={isLoading}
            error={error}
            isStreaming={isStreaming}
            userAvatar={user?.avatar_url || "/default-avatar.svg"}
            messagesEndRef={messagesEndRef}
            messagesStartRef={messagesStartRef}
            chatId={chatId}
            onSelectCandidate={handleSelectCandidate}
            onRegenAssistant={handleRegenAssistant}
            onEditUser={handleEditUser}
            onRetryReplyCard={handleRetryReplyCard}
            playingCandidateId={playingCandidateId}
            ttsLoadingCandidateId={ttsLoadingCandidateId}
            isRecording={isRecording}
            onPlayTts={handlePlayTts}
            onStopTts={handleStopTts}
            isLoadingOlder={isLoadingOlder}
            hasOlderMessages={hasOlderMessages}
        />
    );

    const composerContent = character && !error ? (
        <ChatInput
            onSend={handleSendMessage}
            isStreaming={isStreaming}
            onInterrupt={interruptStream}
            roleName={character.name}
            replySuggestions={currentReplySuggestions}
            onMicStart={handleMicStart}
            onMicCancel={handleMicCancel}
        />
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
        <ChatMainFrame
            scrollRootRef={scrollRootRef}
            header={headerContent}
            thread={threadContent}
            composer={composerContent}
            disclaimer={<div>The content is generated by AI.Please check important info.</div>}
        />
    );
}
