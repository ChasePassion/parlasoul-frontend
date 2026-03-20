"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createPortal } from "react-dom";
import ChatMessage, {
    type Message,
    type MessageActionStatus,
} from "@/components/ChatMessage";
import SentenceCardPopover from "@/components/SentenceCardPopover";
import WordCardPopover from "@/components/WordCardPopover";
import FeedbackCardPopover from "@/components/FeedbackCardPopover";
import type { Character } from "@/components/Sidebar";
import {
    useFloatingPosition,
    type FloatingAnchorRect,
} from "@/hooks/useFloatingPosition";
import { useUserSettings } from "@/lib/user-settings-context";
import {
  ApiError,
  UnauthorizedError,
  createSavedItem,
  deleteSavedItem,
  createWordCard,
  createFeedbackCard,
  createSavedItemPhase3,
  type WordCard,
  type FeedbackCard,
  type SavedItemPayloadPhase3,
  type SavedItemPayload,
} from "@/lib/api";

interface FeedbackCardState {
    status: MessageActionStatus;
    feedbackCard: FeedbackCard | null;
    pendingOpen: boolean;
    requestId: number;
    errorCode?: string | null;
}

const getMessageVersionKey = (message: Message): string =>
    `${message.id}:${message.candidateNo ?? 1}`;

const deriveFeedbackErrorCode = (error: unknown): string => {
    if (error instanceof ApiError) {
        return error.code || `http_${error.status}`;
    }
    if (error instanceof UnauthorizedError) {
        return "unauthorized";
    }
    return "feedback_card_request_failed";
};

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
    onRetrySentenceCard: (message: Message) => Promise<void>;
    // Phase 2: TTS
    playingCandidateId?: string | null;
    ttsLoadingCandidateId?: string | null;
    isRecording?: boolean;
    onPlayTts?: (candidateId: string) => void;
    onStopTts?: (candidateId: string) => void;
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
    onRetrySentenceCard,
    playingCandidateId,
    ttsLoadingCandidateId,
    isRecording,
    onPlayTts,
    onStopTts,
}: ChatThreadProps) {
    const CARD_GAP = 12;
    const VIEWPORT_PADDING = 12;

    const router = useRouter();
    const { messageFontSize, displayMode, knowledgeCardEnabled } = useUserSettings();

    // Knowledge card popover state
    const [openKnowledgeCardKey, setOpenKnowledgeCardKey] = useState<string | null>(null);
    const [pendingKnowledgeCardKey, setPendingKnowledgeCardKey] = useState<string | null>(null);
    const [isFavoriteSaving, setIsFavoriteSaving] = useState(false);
    const cardAnchorRefs = useRef<Map<string, HTMLDivElement>>(new Map());
    const knowledgeCardWrapperRef = useRef<HTMLDivElement | null>(null);
    const [favoriteOverrides, setFavoriteOverrides] = useState<
        Record<string, { isFavorited: boolean; savedItemId: string | null }>
    >({});

    // Phase 3: Word card popover state
    const [wordCard, setWordCard] = useState<WordCard | null>(null);
    const wordCardWrapperRef = useRef<HTMLDivElement | null>(null);
    const [wordCardAnchorRect, setWordCardAnchorRect] = useState<FloatingAnchorRect | null>(null);
    const [isWordCardLoading, setIsWordCardLoading] = useState(false);
    const [isWordCardFavoriteSaving, setIsWordCardFavoriteSaving] = useState(false);
    const [wordCardFavoriteOverride, setWordCardFavoriteOverride] = useState<{
        isFavorited: boolean;
        savedItemId: string | null;
    } | null>(null);
    const selectionButtonRef = useRef<HTMLButtonElement | null>(null);
    const selectionButtonDataRef = useRef<{
        text: string;
        contextText: string | null;
        top: number;
        left: number;
        anchorRect: FloatingAnchorRect;
    } | null>(null);

    // Phase 3: Feedback card popover state
    const [feedbackCard, setFeedbackCard] = useState<FeedbackCard | null>(null);
    const [feedbackCardKey, setFeedbackCardKey] = useState<string | null>(null);
    const feedbackCardWrapperRef = useRef<HTMLDivElement | null>(null);
    const [feedbackCardStates, setFeedbackCardStates] = useState<
        Record<string, FeedbackCardState>
    >({});
    const [feedbackFavoriteOverrides, setFeedbackFavoriteOverrides] = useState<
        Record<string, { isFavorited: boolean; savedItemId: string | null }>
    >({});
    const messageAnchorRefs = useRef<Map<string, HTMLDivElement>>(new Map());
    const feedbackCardStatesRef = useRef<Record<string, FeedbackCardState>>({});
    const feedbackRequestIdRef = useRef(0);
    const feedbackPrefetchInitializedRef = useRef(false);
    const previousUserVersionsRef = useRef<Map<string, { key: string; candidateCount: number }>>(
        new Map()
    );

    useEffect(() => {
        feedbackCardStatesRef.current = feedbackCardStates;
    }, [feedbackCardStates]);

    useEffect(() => {
        setOpenKnowledgeCardKey(null);
        setPendingKnowledgeCardKey(null);
        setFavoriteOverrides({});
        setFeedbackCard(null);
        setFeedbackCardKey(null);
        setFeedbackCardStates({});
        setFeedbackFavoriteOverrides({});
        previousUserVersionsRef.current = new Map();
        feedbackPrefetchInitializedRef.current = false;
    }, [chatId]);

    useEffect(() => {
        setFavoriteOverrides((prev) => {
            const validKeys = new Set(
                messages
                    .filter((message) => message.role === "assistant" && message.sentenceCard)
                    .map(getMessageVersionKey)
            );
            const next: Record<string, { isFavorited: boolean; savedItemId: string | null }> = {};
            let changed = false;

            Object.entries(prev).forEach(([messageKey, value]) => {
                if (validKeys.has(messageKey)) {
                    next[messageKey] = value;
                } else {
                    changed = true;
                }
            });

            return changed ? next : prev;
        });
    }, [messages]);

    const handleOpenKnowledgeCard = useCallback((message: Message) => {
        const messageKey = getMessageVersionKey(message);
        const sentenceCardStatus =
            message.sentenceCardStatus ?? (message.sentenceCard ? "ready" : "idle");

        if (message.sentenceCard) {
            setPendingKnowledgeCardKey(null);
            setOpenKnowledgeCardKey((prev) => (prev === messageKey ? null : messageKey));
            return;
        }

        if (sentenceCardStatus === "loading") {
            setPendingKnowledgeCardKey(messageKey);
            return;
        }

        if (
            (sentenceCardStatus === "idle" || sentenceCardStatus === "error") &&
            message.assistantCandidateId
        ) {
            setPendingKnowledgeCardKey(messageKey);
            void onRetrySentenceCard(message).catch((err) => {
                console.error("Failed to retry sentence card:", err);
            });
        }
    }, [onRetrySentenceCard]);

    const handleCloseKnowledgeCard = useCallback(() => {
        setOpenKnowledgeCardKey(null);
        setPendingKnowledgeCardKey(null);
    }, []);

    const handleToggleFavorite = useCallback(
        async (
            isFavorited: boolean,
            savedItemId: string | null | undefined,
            message: Message
        ): Promise<string | null> => {
            if (!character || !message.sentenceCard) return null;
            const messageKey = getMessageVersionKey(message);
            const previous = favoriteOverrides[messageKey] ?? {
                isFavorited: message.sentenceCard.favorite.is_favorited,
                savedItemId: message.sentenceCard.favorite.saved_item_id ?? null,
            };

            // optimistic state
            setFavoriteOverrides((prev) => ({
                ...prev,
                [messageKey]: {
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
                        [messageKey]: {
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
                        [messageKey]: {
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
                    [messageKey]: previous,
                }));
                throw err;
            } finally {
                setIsFavoriteSaving(false);
            }
        },
        [character, chatId, favoriteOverrides]
    );

    const hideSelectionButton = useCallback(() => {
        selectionButtonDataRef.current = null;
        const button = selectionButtonRef.current;
        if (!button) return;
        button.style.visibility = "hidden";
        button.style.opacity = "0";
        button.style.pointerEvents = "none";
        button.style.transform = "translateX(-50%) scale(0.96)";
    }, []);

    const showSelectionButton = useCallback(
        (buttonData: {
            text: string;
            contextText: string | null;
            top: number;
            left: number;
            anchorRect: FloatingAnchorRect;
        }) => {
            selectionButtonDataRef.current = buttonData;
            const button = selectionButtonRef.current;
            if (!button) return;
            button.style.top = `${buttonData.top}px`;
            button.style.left = `${buttonData.left}px`;
            button.style.visibility = "visible";
            button.style.opacity = "1";
            button.style.pointerEvents = "auto";
            button.style.transform = "translateX(-50%) scale(1)";
        },
        []
    );

    // Phase 3: Text selection handling for word card
    const handleTextSelection = useCallback(() => {
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed || !selection.toString().trim()) {
            hideSelectionButton();
            return;
        }

        const selectedText = selection.toString().trim();
        if (selectedText.length < 2 || selectedText.length > 200) {
            hideSelectionButton();
            return;
        }

        // Only trigger on English text (basic check - contains letters)
        if (!/[a-zA-Z]/.test(selectedText)) {
            hideSelectionButton();
            return;
        }

        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();

        showSelectionButton({
            text: selectedText,
            contextText: range.commonAncestorContainer.textContent?.trim() || null,
            top: rect.bottom + 10,
            left: rect.left + rect.width / 2,
            anchorRect: {
                top: rect.top,
                right: rect.right,
                bottom: rect.bottom,
                left: rect.left,
                width: rect.width,
                height: rect.height,
            },
        });
    }, [hideSelectionButton, showSelectionButton]);

    const handleOpenWordCard = useCallback(async () => {
        const selectionButton = selectionButtonDataRef.current;
        if (!selectionButton) return;

        setIsWordCardLoading(true);
        setWordCardAnchorRect(selectionButton.anchorRect);
        try {
            const response = await createWordCard({
                selected_text: selectionButton.text,
                context_text: selectionButton.contextText,
            });
            setWordCard(response.word_card);
            setWordCardFavoriteOverride(null);
            hideSelectionButton();
        } catch (err) {
            console.error("Failed to create word card:", err);
            setWordCard(null);
            setWordCardFavoriteOverride(null);
            hideSelectionButton();
        } finally {
            setIsWordCardLoading(false);
        }
    }, [hideSelectionButton]);

    useEffect(() => {
        document.addEventListener("mouseup", handleTextSelection);
        return () => {
            document.removeEventListener("mouseup", handleTextSelection);
        };
    }, [handleTextSelection]);

    useEffect(() => {
        const handlePointerDown = (e: MouseEvent) => {
            const target = e.target as HTMLElement | null;
            if (target?.closest("[data-selection-word-trigger='true']")) {
                return;
            }
            const selection = window.getSelection();
            if (!selection || selection.isCollapsed) {
                hideSelectionButton();
            }
        };

        document.addEventListener("mousedown", handlePointerDown);
        return () => {
            document.removeEventListener("mousedown", handlePointerDown);
        };
    }, [hideSelectionButton]);

    const handleCloseWordCard = useCallback(() => {
        setWordCard(null);
        setWordCardAnchorRect(null);
        setWordCardFavoriteOverride(null);
        hideSelectionButton();
        window.getSelection()?.removeAllRanges();
    }, [hideSelectionButton]);

    const handleToggleWordCardFavorite = useCallback(
        async (
            isFavorited: boolean,
            savedItemId: string | null | undefined,
            wordCardData: WordCard
        ): Promise<string | null> => {
            if (!character) return null;

            const previous = wordCardFavoriteOverride ?? {
                isFavorited: wordCardData.favorite.is_favorited,
                savedItemId: wordCardData.favorite.saved_item_id ?? null,
            };

            setWordCardFavoriteOverride({
                isFavorited,
                savedItemId: isFavorited ? previous.savedItemId : null,
            });

            setIsWordCardFavoriteSaving(true);
            try {
                if (isFavorited) {
                    const payload: SavedItemPayloadPhase3 = {
                        kind: "word_card",
                        display: {
                            surface: wordCardData.surface,
                            zh: wordCardData.pos_groups[0]?.senses[0]?.zh || "",
                        },
                        card: wordCardData,
                        source: {
                            role_id: character.id,
                            chat_id: chatId,
                            message_id: `word:${wordCardData.surface}`,
                        },
                    };
                    const created = await createSavedItemPhase3(payload);
                    const nextSavedItemId = created.id ?? null;
                    setWordCardFavoriteOverride({
                        isFavorited: true,
                        savedItemId: nextSavedItemId,
                    });
                    return nextSavedItemId;
                }

                const effectiveSavedItemId = savedItemId ?? previous.savedItemId;
                if (effectiveSavedItemId) {
                    await deleteSavedItem(effectiveSavedItemId);
                }
                setWordCardFavoriteOverride({
                    isFavorited: false,
                    savedItemId: null,
                });
                return null;
            } catch (err) {
                console.error("Failed to toggle word favorite:", err);
                setWordCardFavoriteOverride(previous);
                throw err;
            } finally {
                setIsWordCardFavoriteSaving(false);
            }
        },
        [character, chatId, wordCardFavoriteOverride]
    );

    // Phase 3: Feedback card handling
    const ensureFeedbackCard = useCallback(
        async (message: Message, openWhenReady = false) => {
            const messageKey = getMessageVersionKey(message);
            const current = feedbackCardStatesRef.current[messageKey];

            if (current?.status === "ready" && current.feedbackCard) {
                if (openWhenReady) {
                    setFeedbackCard(current.feedbackCard);
                    setFeedbackCardKey(messageKey);
                }
                return;
            }

            if (current?.status === "loading") {
                if (openWhenReady && !current.pendingOpen) {
                    setFeedbackCardStates((prev) => {
                        const existing = prev[messageKey];
                        if (!existing || existing.pendingOpen) return prev;
                        return {
                            ...prev,
                            [messageKey]: {
                                ...existing,
                                pendingOpen: true,
                            },
                        };
                    });
                }
                return;
            }

            const requestId = ++feedbackRequestIdRef.current;
            setFeedbackCardStates((prev) => ({
                ...prev,
                [messageKey]: {
                    status: "loading",
                    feedbackCard: current?.feedbackCard ?? null,
                    pendingOpen: openWhenReady,
                    requestId,
                    errorCode: null,
                },
            }));

            try {
                const response = await createFeedbackCard(message.id);
                setFeedbackCardStates((prev) => {
                    const existing = prev[messageKey];
                    if (!existing || existing.requestId !== requestId) {
                        return prev;
                    }
                    return {
                        ...prev,
                        [messageKey]: {
                            ...existing,
                            status: "ready",
                            feedbackCard: response.feedback_card,
                            errorCode: null,
                        },
                    };
                });
            } catch (err) {
                console.error("Failed to create feedback card:", err);
                const errorCode = deriveFeedbackErrorCode(err);
                setFeedbackCardStates((prev) => {
                    const existing = prev[messageKey];
                    if (!existing || existing.requestId !== requestId) {
                        return prev;
                    }
                    return {
                        ...prev,
                        [messageKey]: {
                            ...existing,
                            status: "error",
                            pendingOpen: false,
                            errorCode,
                        },
                    };
                });
            }
        },
        []
    );

    useEffect(() => {
        if (isLoading) return;

        const currentUsers = messages.filter(
            (message) => message.role === "user" && !message.isTemp
        );
        const nextVersions = new Map(
            currentUsers.map((message) => [
                message.id,
                {
                    key: getMessageVersionKey(message),
                    candidateCount: message.candidateCount ?? 1,
                },
            ])
        );

        if (!feedbackPrefetchInitializedRef.current) {
            previousUserVersionsRef.current = nextVersions;
            feedbackPrefetchInitializedRef.current = true;
            return;
        }

        const previousVersions = previousUserVersionsRef.current;
        previousUserVersionsRef.current = nextVersions;

        currentUsers.forEach((message) => {
            const previous = previousVersions.get(message.id);
            const currentKey = getMessageVersionKey(message);
            const shouldPrefetch =
                !previous ||
                (previous.key !== currentKey &&
                    (message.candidateCount ?? 1) > previous.candidateCount);

            if (shouldPrefetch) {
                void ensureFeedbackCard(message);
            }
        });
    }, [ensureFeedbackCard, isLoading, messages]);

    useEffect(() => {
        const readyEntry = Object.entries(feedbackCardStates).find(
            ([, state]) =>
                state.pendingOpen && state.status === "ready" && !!state.feedbackCard
        );
        if (!readyEntry) return;

        const [messageKey, state] = readyEntry;
        const targetMessage = messages.find(
            (message) => getMessageVersionKey(message) === messageKey
        );

        setFeedbackCardStates((prev) => {
            const existing = prev[messageKey];
            if (!existing || !existing.pendingOpen) return prev;
            return {
                ...prev,
                [messageKey]: {
                    ...existing,
                    pendingOpen: false,
                },
            };
        });

        if (!targetMessage || !state.feedbackCard) {
            return;
        }

        setFeedbackCard(state.feedbackCard);
        setFeedbackCardKey(messageKey);
    }, [feedbackCardStates, messages]);

    useEffect(() => {
        if (!pendingKnowledgeCardKey) return;

        const targetMessage = messages.find(
            (message) => getMessageVersionKey(message) === pendingKnowledgeCardKey
        );
        if (!targetMessage) {
            setPendingKnowledgeCardKey(null);
            return;
        }

        if (targetMessage.sentenceCard) {
            setOpenKnowledgeCardKey(pendingKnowledgeCardKey);
            setPendingKnowledgeCardKey(null);
            return;
        }

        if (
            targetMessage.sentenceCardStatus === "error" ||
            targetMessage.sentenceCardStatus === "idle"
        ) {
            setPendingKnowledgeCardKey(null);
        }
    }, [messages, pendingKnowledgeCardKey]);

    useEffect(() => {
        if (!feedbackCardKey) return;
        const targetMessage = messages.find(
            (message) => getMessageVersionKey(message) === feedbackCardKey
        );
        if (!targetMessage) {
            setFeedbackCard(null);
            setFeedbackCardKey(null);
        }
    }, [feedbackCardKey, messages]);

    useEffect(() => {
        setFeedbackFavoriteOverrides((prev) => {
            const validKeys = new Set(
                messages
                    .filter((message) => message.role === "user" && !message.isTemp)
                    .map(getMessageVersionKey)
            );
            const next: Record<string, { isFavorited: boolean; savedItemId: string | null }> = {};
            let changed = false;

            Object.entries(prev).forEach(([messageKey, value]) => {
                if (validKeys.has(messageKey)) {
                    next[messageKey] = value;
                } else {
                    changed = true;
                }
            });

            return changed ? next : prev;
        });
    }, [messages]);

    const handleRequestFeedback = useCallback(
        (message: Message) => {
            void ensureFeedbackCard(message, true);
        },
        [ensureFeedbackCard]
    );

    const handleCloseFeedbackCard = useCallback(() => {
        setFeedbackCard(null);
        setFeedbackCardKey(null);
    }, []);

    const feedbackCardMessage = feedbackCardKey
        ? messages.find((message) => getMessageVersionKey(message) === feedbackCardKey) ?? null
        : null;

    const handleToggleFeedbackFavorite = useCallback(
        async (
            isFavorited: boolean,
            savedItemId: string | null | undefined,
            feedbackCardData: FeedbackCard
        ): Promise<string | null> => {
            if (!character || !feedbackCardKey || !feedbackCardMessage) return null;
            const previous = feedbackFavoriteOverrides[feedbackCardKey] ?? {
                isFavorited: feedbackCardData.favorite.is_favorited,
                savedItemId: feedbackCardData.favorite.saved_item_id ?? null,
            };

            setFeedbackFavoriteOverrides((prev) => ({
                ...prev,
                [feedbackCardKey]: {
                    isFavorited,
                    savedItemId: isFavorited ? previous.savedItemId : null,
                },
            }));

            try {
                if (isFavorited) {
                    const payload: SavedItemPayloadPhase3 = {
                        kind: "feedback_card",
                        display: {
                            surface: feedbackCardData.surface,
                            zh: feedbackCardData.zh,
                        },
                        card: feedbackCardData,
                        source: {
                            role_id: character.id,
                            chat_id: chatId,
                            message_id: feedbackCardMessage.id,
                            turn_id: feedbackCardMessage.id,
                            candidate_id: null,
                        },
                    };
                    const created = await createSavedItemPhase3(payload);
                    setFeedbackFavoriteOverrides((prev) => ({
                        ...prev,
                        [feedbackCardKey]: {
                            isFavorited: true,
                            savedItemId: created.id,
                        },
                    }));
                    return created.id;
                } else {
                    const effectiveSavedItemId = savedItemId ?? previous.savedItemId;
                    if (effectiveSavedItemId) {
                        await deleteSavedItem(effectiveSavedItemId);
                    }
                    setFeedbackFavoriteOverrides((prev) => ({
                        ...prev,
                        [feedbackCardKey]: {
                            isFavorited: false,
                            savedItemId: null,
                        },
                    }));
                    return null;
                }
            } catch (err) {
                console.error("Failed to toggle feedback favorite:", err);
                setFeedbackFavoriteOverrides((prev) => ({
                    ...prev,
                    [feedbackCardKey]: previous,
                }));
                throw err;
            }
        },
        [character, chatId, feedbackCardKey, feedbackCardMessage, feedbackFavoriteOverrides]
    );

    const applyFavoriteOverride = useCallback(
        (message: Message): Message => {
            if (!message.sentenceCard) return message;
            const override = favoriteOverrides[getMessageVersionKey(message)];
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

    const openCardMessage = openKnowledgeCardKey
        ? messages
            .map(applyFavoriteOverride)
            .find((message) => getMessageVersionKey(message) === openKnowledgeCardKey)
        : null;
    const knowledgeCardMessage = openCardMessage?.sentenceCard ? openCardMessage : null;
    const visibleMessages = messages.filter(
        (message) =>
            !(
                message.role === "assistant" &&
                message.isTemp &&
                message.content.trim().length === 0
            )
    );
    const knowledgeCardPosition = useFloatingPosition({
        isOpen: Boolean(openKnowledgeCardKey && openCardMessage?.sentenceCard),
        overlayRef: knowledgeCardWrapperRef,
        getAnchorRect: () => {
            if (!openCardMessage?.id) return null;
            const anchor = cardAnchorRefs.current.get(openCardMessage.id);
            return anchor?.getBoundingClientRect() ?? null;
        },
        preferredPlacement: "left",
        gap: CARD_GAP,
        padding: VIEWPORT_PADDING,
    });

    const wordCardPosition = useFloatingPosition({
        isOpen: Boolean(wordCard && wordCardAnchorRect),
        overlayRef: wordCardWrapperRef,
        getAnchorRect: () => wordCardAnchorRect,
        preferredPlacement: "bottom",
        gap: CARD_GAP,
        padding: VIEWPORT_PADDING,
    });

    const feedbackCardPosition = useFloatingPosition({
        isOpen: Boolean(feedbackCard && feedbackCardMessage),
        overlayRef: feedbackCardWrapperRef,
        getAnchorRect: () => {
            if (!feedbackCardMessage?.id) return null;
            const anchor = messageAnchorRefs.current.get(feedbackCardMessage.id);
            return anchor?.getBoundingClientRect() ?? null;
        },
        preferredPlacement: "right",
        gap: CARD_GAP,
        padding: VIEWPORT_PADDING,
    });

    const shouldRenderKnowledgeCard =
        Boolean(openKnowledgeCardKey && knowledgeCardMessage) &&
        typeof document !== "undefined";

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

    return (
        <>
            {visibleMessages.map((message, index) => {
                const renderedMessage = applyFavoriteOverride(message);
                const messageKey = getMessageVersionKey(renderedMessage);
                const feedbackStatus = feedbackCardStates[messageKey]?.status ?? "idle";
                const sentenceCardStatus =
                    renderedMessage.sentenceCardStatus ??
                    (renderedMessage.sentenceCard ? "ready" : "idle");
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
                                            if (el) {
                                                messageAnchorRefs.current.set(message.id, el);
                                            } else {
                                                messageAnchorRefs.current.delete(message.id);
                                            }
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
                                            actionsDisabled={false}
                                            knowledgeCardDisabled={isFavoriteSaving}
                                            sentenceCardStatus={sentenceCardStatus}
                                            feedbackStatus={feedbackStatus}
                                            displayMode={displayMode}
                                            knowledgeCardEnabled={knowledgeCardEnabled}
                                            playingCandidateId={playingCandidateId}
                                            ttsLoadingCandidateId={ttsLoadingCandidateId}
                                            isRecording={isRecording}
                                            ttsStreamingDisabled={!message.isTemp && isStreaming}
                                            onPlayTts={onPlayTts}
                                            onStopTts={onStopTts}
                                            onSelectCandidate={onSelectCandidate}
                                            onRegenAssistant={onRegenAssistant}
                                            onEditUser={onEditUser}
                                            onOpenKnowledgeCard={handleOpenKnowledgeCard}
                                            onRequestFeedback={handleRequestFeedback}
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
            {shouldRenderKnowledgeCard &&
                createPortal(
                    <div
                        ref={knowledgeCardWrapperRef}
                        style={{
                            position: "fixed",
                            top: knowledgeCardPosition ? `${knowledgeCardPosition.top}px` : "0px",
                            left: knowledgeCardPosition ? `${knowledgeCardPosition.left}px` : "0px",
                            zIndex: 60,
                            visibility: knowledgeCardPosition ? "visible" : "hidden",
                            pointerEvents: knowledgeCardPosition ? "auto" : "none",
                        }}
                    >
                        <SentenceCardPopover
                            sentenceCard={knowledgeCardMessage!.sentenceCard!}
                            onToggleFavorite={(isFavorited, savedItemId) =>
                                handleToggleFavorite(
                                    isFavorited,
                                    savedItemId,
                                    knowledgeCardMessage!
                                )
                            }
                            isSaving={isFavoriteSaving}
                            onClose={handleCloseKnowledgeCard}
                        />
                    </div>,
                    document.body
                )}

            {wordCard && typeof document !== "undefined" && (
                createPortal(
                    <div
                        ref={wordCardWrapperRef}
                        style={{
                            position: "fixed",
                            top: wordCardPosition ? `${wordCardPosition.top}px` : "0px",
                            left: wordCardPosition ? `${wordCardPosition.left}px` : "0px",
                            zIndex: 60,
                            visibility: wordCardPosition ? "visible" : "hidden",
                            pointerEvents: wordCardPosition ? "auto" : "none",
                        }}
                    >
                        <WordCardPopover
                            wordCard={{
                                ...wordCard,
                                favorite: {
                                    ...wordCard.favorite,
                                    is_favorited: wordCardFavoriteOverride?.isFavorited ?? wordCard.favorite.is_favorited,
                                    saved_item_id: wordCardFavoriteOverride?.savedItemId ?? wordCard.favorite.saved_item_id,
                                },
                            }}
                            onToggleFavorite={(isFavorited, savedItemId) =>
                                handleToggleWordCardFavorite(isFavorited, savedItemId, wordCard)
                            }
                            isSaving={isWordCardLoading || isWordCardFavoriteSaving}
                            onClose={handleCloseWordCard}
                        />
                    </div>,
                    document.body
                )
            )}

            {typeof document !== "undefined" &&
                createPortal(
                    <button
                        ref={selectionButtonRef}
                        type="button"
                        data-selection-word-trigger="true"
                        onClick={() => {
                            void handleOpenWordCard();
                        }}
                        onMouseDown={(e) => {
                            e.preventDefault();
                        }}
                        disabled={isWordCardLoading}
                        style={{
                            position: "fixed",
                            top: "0px",
                            left: "0px",
                            transform: "translateX(-50%) scale(0.96)",
                            zIndex: 65,
                            visibility: "hidden",
                            opacity: 0,
                            pointerEvents: "none",
                            paddingLeft: isWordCardLoading ? "8px" : "4px",
                            paddingRight: isWordCardLoading ? "8px" : "4px",
                        }}
                        className="flex h-8 items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-white shadow-lg transition-[opacity,transform] duration-150 hover:scale-[1.03] disabled:pointer-events-auto disabled:cursor-not-allowed"
                        aria-label="打开单词卡"
                    >
                        {isWordCardLoading ? (
                            <svg
                                className="animate-spin h-4 w-4 text-blue-600"
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                            >
                                <circle
                                    className="opacity-25"
                                    cx="12"
                                    cy="12"
                                    r="10"
                                    stroke="currentColor"
                                    strokeWidth="4"
                                />
                                <path
                                    className="opacity-75"
                                    fill="currentColor"
                                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                />
                            </svg>
                        ) : (
                            <Image src="/translate.svg" alt="" width={24} height={24} />
                        )}
                    </button>,
                    document.body
                )
            }

            {feedbackCard && typeof document !== "undefined" && (
                createPortal(
                    <div
                        ref={feedbackCardWrapperRef}
                        style={{
                            position: "fixed",
                            top: feedbackCardPosition ? `${feedbackCardPosition.top}px` : "0px",
                            left: feedbackCardPosition ? `${feedbackCardPosition.left}px` : "0px",
                            zIndex: 60,
                            visibility: feedbackCardPosition ? "visible" : "hidden",
                            pointerEvents: feedbackCardPosition ? "auto" : "none",
                        }}
                    >
                        <FeedbackCardPopover
                            feedbackCard={{
                                ...feedbackCard,
                                favorite: {
                                    ...feedbackCard.favorite,
                                    is_favorited:
                                        feedbackFavoriteOverrides[feedbackCardKey || ""]?.isFavorited ??
                                        feedbackCard.favorite.is_favorited,
                                    saved_item_id:
                                        feedbackFavoriteOverrides[feedbackCardKey || ""]?.savedItemId ??
                                        feedbackCard.favorite.saved_item_id,
                                },
                            }}
                            onToggleFavorite={(isFavorited, savedItemId) =>
                                handleToggleFeedbackFavorite(isFavorited, savedItemId, feedbackCard)
                            }
                            isSaving={false}
                            onClose={handleCloseFeedbackCard}
                        />
                    </div>,
                    document.body
                )
            )}

            <div className="h-24 sm:h-28" aria-hidden="true" />
            <div ref={messagesEndRef} />
        </>
    );
}
