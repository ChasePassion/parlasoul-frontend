"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import Markdown from "./Markdown";
import MixedInputTransformBox from "./MixedInputTransformBox";
import type { InputTransform, SentenceCard, ReplySuggestion, DisplayMode } from "@/lib/api";

export interface Message {
    id: string;
    role: "user" | "assistant";
    content: string;
    candidateNo?: number;
    candidateCount?: number;
    isTemp?: boolean;
    isGreeting?: boolean;
    // Phase 1 learning fields
    inputTransform?: InputTransform | null;
    sentenceCard?: SentenceCard | null;
    replySuggestions?: ReplySuggestion[] | null;
    transformChunks?: string;
    assistantTurnId?: string;
    assistantCandidateId?: string;
}

interface ChatMessageProps {
    message: Message;
    userAvatar: string;
    assistantAvatar: string;
    messageFontSize: number;
    actionsDisabled?: boolean;
    knowledgeCardDisabled?: boolean;
    displayMode?: DisplayMode;
    knowledgeCardEnabled?: boolean;
    onSelectCandidate?: (turnId: string, candidateNo: number) => void;
    onRegenAssistant?: (turnId: string) => void;
    onEditUser?: (turnId: string, newContent: string) => void;
    onOpenKnowledgeCard?: (messageId: string) => void;
}

export default function ChatMessage({
    message,
    userAvatar,
    assistantAvatar,
    messageFontSize,
    actionsDisabled = false,
    knowledgeCardDisabled = false,
    displayMode = "concise",
    knowledgeCardEnabled = false,
    onSelectCandidate,
    onRegenAssistant,
    onEditUser,
    onOpenKnowledgeCard,
}: ChatMessageProps) {
    const userActionRowHideDelayMs = 500;
    const chevronLeftIcon = "/icons/chevron-left-8ee2e9.svg";
    const duplicateIcon = "/icons/duplicate-ce3544.svg";
    const checkIcon = "/icons/check-fa1dbd.svg";
    const editIcon = "/icons/edit-6d87e1.svg";
    const ideaIcon = "/os-icon-idea.svg";
    const branchButtonClass =
        "text-token-text-secondary hover:bg-token-bg-secondary rounded-md disabled:opacity-50";
    const actionButtonClass =
        "text-token-text-secondary hover:bg-token-bg-secondary rounded-lg disabled:opacity-50";
    const isUser = message.role === "user";
    const k = message.candidateNo ?? 1;
    const n = message.candidateCount ?? 1;
    const showNav =
        !message.isTemp &&
        !message.isGreeting &&
        message.candidateNo !== undefined &&
        message.candidateCount !== undefined;
    const [isUserMessageHovering, setIsUserMessageHovering] = useState(false);
    const [isTouchLikeDevice, setIsTouchLikeDevice] = useState(false);
    const isActionRowVisible = !isUser || isTouchLikeDevice || isUserMessageHovering;
    const renderActionIcon = (iconSrc: string, className = "", size: "branch" | "action" = "action") => (
        <span className={`flex items-center justify-center ${size === "branch" ? "h-[30px] w-[24px]" : "h-8 w-8"}`}>
            <span
                aria-hidden="true"
                className={`inline-block h-5 w-5 shrink-0 ${className}`}
                style={{
                    backgroundColor: "#5D5D5D",
                    WebkitMaskImage: `url(${iconSrc})`,
                    maskImage: `url(${iconSrc})`,
                    WebkitMaskRepeat: "no-repeat",
                    maskRepeat: "no-repeat",
                    WebkitMaskPosition: "center",
                    maskPosition: "center",
                    WebkitMaskSize: "contain",
                    maskSize: "contain",
                }}
                data-icon-src={iconSrc}
            />
        </span>
    );

    const [isEditing, setIsEditing] = useState(false);
    const [draft, setDraft] = useState(message.content);
    const [isCopySuccess, setIsCopySuccess] = useState(false);
    const copyResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const hoverLeaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const messageTextStyle: CSSProperties = { fontSize: `${messageFontSize}px` };

    const copyTextToClipboard = async (text: string): Promise<boolean> => {
        if (!text) return false;
        if (typeof window === "undefined") return false;

        if (navigator.clipboard?.writeText) {
            try {
                await navigator.clipboard.writeText(text);
                return true;
            } catch {
                // Fallback below for blocked clipboard permissions/runtime failures.
            }
        }

        try {
            const textarea = document.createElement("textarea");
            textarea.value = text;
            textarea.setAttribute("readonly", "");
            textarea.style.position = "fixed";
            textarea.style.left = "-9999px";
            textarea.style.opacity = "0";
            document.body.appendChild(textarea);

            const selection = document.getSelection();
            const selectedRange =
                selection && selection.rangeCount > 0
                    ? selection.getRangeAt(0)
                    : null;

            textarea.focus();
            textarea.select();
            textarea.setSelectionRange(0, textarea.value.length);
            const copied = document.execCommand("copy");
            document.body.removeChild(textarea);

            if (selection) {
                selection.removeAllRanges();
                if (selectedRange) {
                    selection.addRange(selectedRange);
                }
            }

            return copied;
        } catch {
            return false;
        }
    };

    useEffect(() => {
        if (!isEditing) setDraft(message.content);
    }, [message.content, isEditing]);

    useEffect(() => {
        setIsCopySuccess(false);
    }, [message.id, message.content]);

    useEffect(() => {
        if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
        const mediaQuery = window.matchMedia("(hover: none), (pointer: coarse)");
        const updateTouchLike = () => setIsTouchLikeDevice(mediaQuery.matches);
        updateTouchLike();

        if (typeof mediaQuery.addEventListener === "function") {
            mediaQuery.addEventListener("change", updateTouchLike);
            return () => mediaQuery.removeEventListener("change", updateTouchLike);
        }

        mediaQuery.addListener(updateTouchLike);
        return () => mediaQuery.removeListener(updateTouchLike);
    }, []);

    useEffect(() => {
        return () => {
            if (copyResetTimerRef.current) {
                clearTimeout(copyResetTimerRef.current);
            }
            if (hoverLeaveTimerRef.current) {
                clearTimeout(hoverLeaveTimerRef.current);
            }
        };
    }, []);

    const clearHoverLeaveTimer = () => {
        if (!hoverLeaveTimerRef.current) return;
        clearTimeout(hoverLeaveTimerRef.current);
        hoverLeaveTimerRef.current = null;
    };

    const handleUserMessageMouseEnter = () => {
        clearHoverLeaveTimer();
        setIsUserMessageHovering(true);
    };

    const handleUserMessageMouseLeave = () => {
        clearHoverLeaveTimer();
        hoverLeaveTimerRef.current = setTimeout(() => {
            setIsUserMessageHovering(false);
            hoverLeaveTimerRef.current = null;
        }, userActionRowHideDelayMs);
    };

    const handleLeft = () => {
        if (actionsDisabled) return;
        if (!showNav) return;
        if (!onSelectCandidate) return;
        if (k <= 1) return;
        onSelectCandidate(message.id, k - 1);
    };

    const handleRight = () => {
        if (actionsDisabled) return;
        if (!showNav) return;
        if (k < n) {
            onSelectCandidate?.(message.id, k + 1);
            return;
        }
        if (message.role === "assistant" && n < 10) {
            onRegenAssistant?.(message.id);
        }
    };

    const handleEdit = () => {
        if (actionsDisabled) return;
        if (message.role !== "user") return;
        if (!showNav) return;
        if (n >= 10) return;
        setIsEditing(true);
    };

    const handleEditCancel = () => {
        setIsEditing(false);
        setDraft(message.content);
    };

    const handleEditSend = () => {
        if (actionsDisabled) return;
        const next = draft.trim();
        if (!next) return;
        onEditUser?.(message.id, next);
        setIsEditing(false);
    };

    const handleCopy = async () => {
        if (actionsDisabled) return;
        if (!message.content) return;
        const copied = await copyTextToClipboard(message.content);
        if (copied) {
            setIsCopySuccess(true);
            if (copyResetTimerRef.current) {
                clearTimeout(copyResetTimerRef.current);
            }
            copyResetTimerRef.current = setTimeout(() => {
                setIsCopySuccess(false);
            }, 1500);
        }
    };

    // Phase 1: Whether to show mixed-input transform box under user message
    const showTransformBox = isUser && (
        (message.inputTransform?.applied && message.inputTransform.transformed_content) ||
        message.transformChunks
    );

    const transformContent = message.inputTransform?.applied
        ? message.inputTransform.transformed_content
        : message.transformChunks || "";

    const isTransformStreaming = !message.inputTransform?.applied && !!message.transformChunks;

    // Phase 1: Whether to show detailed mode extras under assistant message
    const showDetailedExtras = !isUser && displayMode === "detailed" && message.sentenceCard;

    // Phase 1: Whether to show knowledge card (lightbulb) button
    const showKnowledgeCardBtn = !isUser && knowledgeCardEnabled && message.sentenceCard && !message.isTemp;
    const showActionRow = showNav || showKnowledgeCardBtn;

    return (
        <div className="relative flex w-full min-w-0 flex-col">
            <div
                className={`flex max-w-full items-start gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}
            >
                {/* Avatar */}
                <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg">
                    {isUser ? (
                        <Image
                            src={userAvatar}
                            alt="User"
                            fill
                            className="object-cover"
                        />
                    ) : (
                        <Image
                            src={assistantAvatar}
                            alt="Assistant"
                            fill
                            className="object-cover"
                        />
                    )}
                </div>

                {/* One message block: bubble + action row */}
                <div
                    className={
                        isUser
                            ? "relative flex w-[70%] min-w-0 flex-col items-end"
                            : "flex min-w-0 max-w-[70%] flex-col"
                    }
                    onMouseEnter={
                        isUser && !isTouchLikeDevice ? handleUserMessageMouseEnter : undefined
                    }
                    onMouseLeave={
                        isUser && !isTouchLikeDevice ? handleUserMessageMouseLeave : undefined
                    }
                >
                    <div
                        className={`w-fit max-w-full px-4 py-1.5 min-h-9 flex items-center ${isUser ? "bubble-user" : "bubble-assistant"}`}
                    >
                        {isEditing ? (
                            <div className="space-y-2">
                                <textarea
                                    value={draft}
                                    onChange={(e) => setDraft(e.target.value)}
                                    rows={3}
                                    className="w-full resize-none bg-transparent leading-normal whitespace-pre-wrap focus:outline-none"
                                    style={messageTextStyle}
                                    disabled={actionsDisabled}
                                />
                                <div className={`flex gap-2 ${isUser ? "justify-end" : "justify-start"}`}>
                                    <button
                                        type="button"
                                        className="text-xs px-2 py-1 rounded border border-divider text-text-secondary hover:bg-gray-50 disabled:opacity-50"
                                        onClick={handleEditCancel}
                                        disabled={actionsDisabled}
                                    >
                                        取消
                                    </button>
                                    <button
                                        type="button"
                                        className="text-xs px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                                        onClick={handleEditSend}
                                        disabled={actionsDisabled || !draft.trim()}
                                    >
                                        发送
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="leading-normal w-full" style={messageTextStyle}>
                                {isUser ? (
                                    <p className="whitespace-pre-wrap">{message.content}</p>
                                ) : (
                                    <Markdown content={message.content} variant="assistant" />
                                )}
                            </div>
                        )}
                    </div>

                    {/* Phase 1: Detailed mode extras (zh + ipa) under assistant bubble */}
                    {showDetailedExtras && message.sentenceCard && (
                        <div className="mt-1 px-1 max-w-full">
                            <p className="text-sm text-gray-500 leading-relaxed">
                                {message.sentenceCard.zh}
                            </p>
                        </div>
                    )}

                    {/* Phase 1: Mixed-input transform box under user bubble */}
                    {showTransformBox && (
                        <div className="w-fit max-w-full">
                            <MixedInputTransformBox
                                transformedContent={transformContent}
                                isStreaming={isTransformStreaming}
                            />
                        </div>
                    )}

                    {showActionRow && (
                        <div
                            className={`mt-1 flex h-8 w-full items-center gap-1 ${isUser ? "justify-end transition-opacity duration-200 ease-out" : "justify-start"} ${isUser && !isActionRowVisible ? "pointer-events-none opacity-0" : "opacity-100"}`}
                        >
                            {showNav && (
                                <div className="flex items-center justify-center text-text-secondary">
                                    <button
                                        type="button"
                                        className={branchButtonClass}
                                        onClick={handleLeft}
                                        disabled={actionsDisabled || k <= 1}
                                        aria-label="上一分支"
                                    >
                                        {renderActionIcon(chevronLeftIcon, "", "branch")}
                                    </button>
                                    <div className="px-0.5 text-sm font-semibold tabular-nums text-text-secondary">
                                        {k}/{n}
                                    </div>
                                    <button
                                        type="button"
                                        className={branchButtonClass}
                                        onClick={handleRight}
                                        disabled={
                                            actionsDisabled ||
                                            (k >= n && (message.role !== "assistant" || n >= 10))
                                        }
                                        aria-label="下一分支"
                                    >
                                        {renderActionIcon(chevronLeftIcon, "rotate-180", "branch")}
                                    </button>
                                </div>
                            )}

                            {showNav && (
                                <button
                                    type="button"
                                    className={actionButtonClass}
                                    onClick={() => {
                                        void handleCopy();
                                    }}
                                    disabled={actionsDisabled || !message.content}
                                    aria-label="复制原文"
                                >
                                    {renderActionIcon(isCopySuccess ? checkIcon : duplicateIcon)}
                                </button>
                            )}

                            {showNav && message.role === "user" && (
                                <button
                                    type="button"
                                    className={actionButtonClass}
                                    onClick={handleEdit}
                                    disabled={actionsDisabled || n >= 10}
                                    aria-label="编辑"
                                >
                                    {renderActionIcon(editIcon)}
                                </button>
                            )}

                            {/* Phase 1: Knowledge card lightbulb button */}
                            {showKnowledgeCardBtn && (
                                <button
                                    type="button"
                                    className={actionButtonClass}
                                    onClick={() => onOpenKnowledgeCard?.(message.id)}
                                    disabled={knowledgeCardDisabled}
                                    aria-label="知识卡"
                                >
                                    {renderActionIcon(ideaIcon)}
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
