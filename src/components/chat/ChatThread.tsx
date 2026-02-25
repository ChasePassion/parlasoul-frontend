"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import ChatMessage, { type Message } from "@/components/ChatMessage";
import SentenceCardPopover from "@/components/SentenceCardPopover";
import type { Character } from "@/components/Sidebar";
import { useUserSettings } from "@/lib/user-settings-context";
import { createSavedItem, deleteSavedItem } from "@/lib/api";
import type { SavedItemPayload } from "@/lib/api";

interface ChatThreadProps {
    character: Character | null;
    messages: Message[];
    isLoading: boolean;
    error: string | null;
    isStreaming: boolean;
    userAvatar: string;
    messagesEndRef: RefObject<HTMLDivElement | null>;
    chatId: string;
    onSelectCandidate: (turnId: string, candidateNo: number) => void;
    onRegenAssistant: (turnId: string) => void;
    onEditUser: (turnId: string, newContent: string) => void;
}

export default function ChatThread({
    character,
    messages,
    isLoading,
    error,
    isStreaming,
    userAvatar,
    messagesEndRef,
    chatId,
    onSelectCandidate,
    onRegenAssistant,
    onEditUser,
}: ChatThreadProps) {
    const CARD_WIDTH = 320;
    const CARD_HEIGHT = 360;
    const CARD_GAP = 12;
    const VIEWPORT_PADDING = 12;

    const router = useRouter();
    const { messageFontSize, displayMode, knowledgeCardEnabled } = useUserSettings();

    // Knowledge card popover state
    const [openCardMessageId, setOpenCardMessageId] = useState<string | null>(null);
    const [isFavoriteSaving, setIsFavoriteSaving] = useState(false);
    const cardAnchorRefs = useRef<Map<string, HTMLDivElement>>(new Map());
    const [cardPosition, setCardPosition] = useState<{ top: number; left: number } | null>(null);
    const [favoriteOverrides, setFavoriteOverrides] = useState<
        Record<string, { isFavorited: boolean; savedItemId: string | null }>
    >({});

    useEffect(() => {
        setFavoriteOverrides((prev) => {
            const validIds = new Set(messages.map((message) => message.id));
            const next: Record<string, { isFavorited: boolean; savedItemId: string | null }> = {};
            let changed = false;

            Object.entries(prev).forEach(([messageId, value]) => {
                if (validIds.has(messageId)) {
                    next[messageId] = value;
                } else {
                    changed = true;
                }
            });

            return changed ? next : prev;
        });
    }, [messages]);

    const handleOpenKnowledgeCard = useCallback((messageId: string) => {
        setOpenCardMessageId((prev) => (prev === messageId ? null : messageId));
    }, []);

    const handleCloseKnowledgeCard = useCallback(() => {
        setOpenCardMessageId(null);
    }, []);

    const applyFavoriteOverride = useCallback(
        (message: Message): Message => {
            if (!message.sentenceCard) return message;
            const override = favoriteOverrides[message.id];
            if (!override) return message;

            return {
                ...message,
                sentenceCard: {
                    ...message.sentenceCard,
                    favorite: {
                        ...message.sentenceCard.favorite,
                        is_favorited: override.isFavorited,
                        saved_item_id: override.savedItemId,
                    },
                },
            };
        },
        [favoriteOverrides]
    );

    useEffect(() => {
        if (!openCardMessageId) {
            setCardPosition(null);
            return;
        }

        const updateCardPosition = () => {
            const anchor = cardAnchorRefs.current.get(openCardMessageId);
            if (!anchor) {
                setCardPosition(null);
                return;
            }

            const rect = anchor.getBoundingClientRect();
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;

            let left = rect.left - CARD_WIDTH - CARD_GAP;
            if (left < VIEWPORT_PADDING) {
                left = rect.right + CARD_GAP;
            }
            left = Math.max(VIEWPORT_PADDING, Math.min(left, viewportWidth - CARD_WIDTH - VIEWPORT_PADDING));

            const minTop = VIEWPORT_PADDING;
            const maxTop = Math.max(minTop, viewportHeight - CARD_HEIGHT - VIEWPORT_PADDING);
            const centeredTop = rect.top + rect.height / 2 - CARD_HEIGHT / 2;
            const top = Math.max(minTop, Math.min(centeredTop, maxTop));

            setCardPosition({ top, left });
        };

        updateCardPosition();
        window.addEventListener("resize", updateCardPosition);
        window.addEventListener("scroll", updateCardPosition, true);

        return () => {
            window.removeEventListener("resize", updateCardPosition);
            window.removeEventListener("scroll", updateCardPosition, true);
        };
    }, [openCardMessageId]);

    const handleToggleFavorite = useCallback(
        async (
            isFavorited: boolean,
            savedItemId: string | null | undefined,
            message: Message
        ): Promise<string | null> => {
            if (!character || !message.sentenceCard) return null;
            const previous = favoriteOverrides[message.id] ?? {
                isFavorited: message.sentenceCard.favorite.is_favorited,
                savedItemId: message.sentenceCard.favorite.saved_item_id ?? null,
            };

            // optimistic state
            setFavoriteOverrides((prev) => ({
                ...prev,
                [message.id]: {
                    isFavorited,
                    savedItemId: isFavorited
                        ? previous.savedItemId
                        : null,
                },
            }));

            setIsFavoriteSaving(true);
            try {
                if (isFavorited) {
                    // Create saved item
                    const payload: SavedItemPayload = {
                        kind: "sentence_card",
                        display: {
                            surface: message.sentenceCard.surface,
                            zh: message.sentenceCard.zh,
                        },
                        card: message.sentenceCard,
                        source: {
                            role_id: character.id,
                            chat_id: chatId,
                            message_id: message.id,
                            turn_id: message.assistantTurnId ?? null,
                            candidate_id: message.assistantCandidateId ?? null,
                        },
                    };
                    const created = await createSavedItem(payload);
                    const nextSavedId = created.id ?? null;
                    setFavoriteOverrides((prev) => ({
                        ...prev,
                        [message.id]: {
                            isFavorited: true,
                            savedItemId: nextSavedId,
                        },
                    }));
                    return nextSavedId;
                } else {
                    // Delete saved item
                    const effectiveSavedItemId = savedItemId ?? previous.savedItemId;
                    if (effectiveSavedItemId) {
                        await deleteSavedItem(effectiveSavedItemId);
                    }
                    setFavoriteOverrides((prev) => ({
                        ...prev,
                        [message.id]: {
                            isFavorited: false,
                            savedItemId: null,
                        },
                    }));
                    return null;
                }
            } catch (err) {
                console.error("Failed to toggle favorite:", err);
                setFavoriteOverrides((prev) => ({
                    ...prev,
                    [message.id]: previous,
                }));
                throw err;
            } finally {
                setIsFavoriteSaving(false);
            }
        },
        [character, chatId, favoriteOverrides]
    );

    if (isLoading) {
        return (
            <div className="flex min-h-[40vh] items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"></div>
            </div>
        );
    }

    if (error || !character) {
        return (
            <div className="flex min-h-[40vh] items-center justify-center">
                <div className="text-center">
                    <p className="text-red-500 mb-4">{error || "Chat not found"}</p>
                    <button
                        onClick={() => router.push("/")}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                        返回首页
                    </button>
                </div>
            </div>
        );
    }

    const openCardMessage = openCardMessageId
        ? messages.map(applyFavoriteOverride).find((m) => m.id === openCardMessageId)
        : null;
    const visibleMessages = messages.filter(
        (message) =>
            !(
                message.role === "assistant" &&
                message.isTemp &&
                message.content.trim().length === 0
            )
    );
    const shouldRenderFloatingCard = !!(
        openCardMessageId &&
        openCardMessage?.sentenceCard &&
        cardPosition &&
        typeof document !== "undefined"
    );

    return (
        <>
            {visibleMessages.map((message, index) => {
                const renderedMessage = applyFavoriteOverride(message);
                const isUserTurn = message.role === "user";
                const isLastTurn = index === visibleMessages.length - 1;
                const topPaddingClass = message.isGreeting
                    ? "pt-[36px]"
                    : isUserTurn
                        ? "pt-3"
                        : "";

                return (
                    <article
                        key={message.id}
                        className={
                            isUserTurn
                                ? "text-token-text-primary w-full focus:outline-none [--shadow-height:45px] scroll-mt-(--header-height)"
                                : "text-token-text-primary w-full focus:outline-none [--shadow-height:45px] [content-visibility:auto] supports-[content-visibility:auto]:[contain-intrinsic-size:auto_100lvh] scroll-mt-[calc(var(--header-height)+min(200px,max(70px,20svh)))]"
                        }
                        tabIndex={-1}
                        dir="auto"
                        data-turn-id={message.id}
                        data-testid={`conversation-turn-${index + 1}`}
                        data-scroll-anchor={isLastTurn ? "true" : "false"}
                        data-turn={message.role}
                    >
                        {isUserTurn ? (
                            <h5 className="sr-only">You said:</h5>
                        ) : (
                            <h6 className="sr-only">ChatGPT said:</h6>
                        )}
                        <div
                            className={`text-base my-auto mx-auto px-3 sm:px-4 lg:px-0 ${topPaddingClass}`}
                        >
                            <div
                                className={`mx-auto w-full max-w-[44rem] lg:max-w-[calc(100%-320px)] flex-1 group/turn-messages focus-visible:outline-hidden relative flex min-w-0 flex-col ${
                                    isUserTurn ? "" : "agent-turn"
                                }`}
                                tabIndex={-1}
                            >
                                <div className="flex max-w-full flex-col grow">
                                    <div
                                        data-message-author-role={isUserTurn ? "user" : "assistant"}
                                        data-message-id={message.id}
                                        dir="auto"
                                        className="min-h-8 text-message relative flex w-full flex-col items-end gap-2 text-start break-words whitespace-normal [.text-message+&]:mt-1"
                                        ref={(el) => {
                                            if (!isUserTurn) {
                                                if (el) {
                                                    cardAnchorRefs.current.set(message.id, el);
                                                } else {
                                                    cardAnchorRefs.current.delete(message.id);
                                                }
                                            }
                                        }}
                                    >
                                        <ChatMessage
                                            message={renderedMessage}
                                            userAvatar={userAvatar}
                                            assistantAvatar={character.avatar}
                                            messageFontSize={messageFontSize}
                                            actionsDisabled={isStreaming}
                                            knowledgeCardDisabled={isFavoriteSaving}
                                            displayMode={displayMode}
                                            knowledgeCardEnabled={knowledgeCardEnabled}
                                            onSelectCandidate={onSelectCandidate}
                                            onRegenAssistant={onRegenAssistant}
                                            onEditUser={onEditUser}
                                            onOpenKnowledgeCard={handleOpenKnowledgeCard}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                        <span className="sr-only">
                            <br />
                        </span>
                    </article>
                );
            })}
            {shouldRenderFloatingCard &&
                createPortal(
                    <div
                        style={{
                            position: "fixed",
                            top: `${cardPosition.top}px`,
                            left: `${cardPosition.left}px`,
                            zIndex: 60,
                        }}
                    >
                        <SentenceCardPopover
                            sentenceCard={openCardMessage.sentenceCard!}
                            onToggleFavorite={(isFavorited, savedItemId) =>
                                handleToggleFavorite(
                                    isFavorited,
                                    savedItemId,
                                    openCardMessage
                                )
                            }
                            isSaving={isFavoriteSaving}
                            onClose={handleCloseKnowledgeCard}
                        />
                    </div>,
                    document.body
                )}
            <div className="h-24 sm:h-28" aria-hidden="true" />
            <div ref={messagesEndRef} />
        </>
    );
}
