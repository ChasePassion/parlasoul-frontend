"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Markdown from "./Markdown";
import MixedInputTransformBox from "./MixedInputTransformBox";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import type { InputTransform, SentenceCard, ReplySuggestion, DisplayMode } from "@/lib/api";

export type MessageActionStatus = "idle" | "loading" | "ready" | "error";
export type MessageStreamStatus = "idle" | "streaming" | "done" | "error";

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
    messageStreamStatus?: MessageStreamStatus;
    sentenceCardStatus?: MessageActionStatus;
    sentenceCardErrorCode?: string | null;
}

interface ChatMessageProps {message: Message;
    userAvatar: string;
    assistantAvatar: string;
    messageFontSize: number;
    actionsDisabled?: boolean;
    knowledgeCardDisabled?: boolean;
    sentenceCardStatus?: MessageActionStatus;
    feedbackStatus?: MessageActionStatus;
    displayMode?: DisplayMode;
    knowledgeCardEnabled?: boolean;
    // Phase 2: TTS
    playingCandidateId?: string | null;
    ttsLoadingCandidateId?: string | null;
    isRecording?: boolean;
    ttsStreamingDisabled?: boolean;
    onPlayTts?: (candidateId: string) => void;
    onStopTts?: (candidateId: string) => void;
    onSelectCandidate?: (turnId: string, candidateNo: number) => Promise<void>;
    onRegenAssistant?: (turnId: string) => Promise<void>;
    onEditUser?: (turnId: string, newContent: string) => Promise<void>;
    onOpenKnowledgeCard?: (message: Message) => void;
    onRequestFeedback?: (message: Message) => void;
}

export default function ChatMessage({
    message,
    userAvatar,
    assistantAvatar,
    messageFontSize,
    actionsDisabled = false,
    knowledgeCardDisabled = false,
    sentenceCardStatus = message.sentenceCardStatus ?? (message.sentenceCard ? "ready" : "idle"),
    feedbackStatus = "idle",
    displayMode = "concise",
    knowledgeCardEnabled = false,
    playingCandidateId,
    ttsLoadingCandidateId,
    isRecording = false,
    ttsStreamingDisabled = false,
    onPlayTts,
    onStopTts,
    onSelectCandidate,
    onRegenAssistant,
    onEditUser,
    onOpenKnowledgeCard,
    onRequestFeedback,
}: ChatMessageProps) {
    const userActionRowHideDelayMs = 500;
    const chevronLeftIcon = "/icons/chevron-left-8ee2e9.svg";
    const duplicateIcon = "/icons/duplicate-ce3544.svg";
    const checkIcon = "/icons/check-recording-fa1dbd.svg";
    const editIcon = "/icons/edit-6d87e1.svg";
    const ideaIcon = "/icons/os-icon-idea.svg";
    const knowledgeCardIcon = "/book.svg";
    
    const branchButtonClass =
        "text-token-text-secondary hover:bg-token-bg-secondary rounded-md disabled:opacity-50";
    const actionButtonClass =
        "text-token-text-secondary hover:bg-token-bg-secondary rounded-lg disabled:opacity-50";
    const isUser = message.role === "user";
    const k = message.candidateNo ?? 1;
    const n = message.candidateCount ?? 1;
    const showNav =
        (isUser|| !message.isTemp) &&
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
    const renderLoadingSpinner = () => (
        <span className="flex h-8 w-8 items-center justify-center" aria-hidden="true">
            <svg
                className="h-4 w-4 animate-spin text-blue-600"
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
    const showKnowledgeCardBtn =
        !isUser &&
        knowledgeCardEnabled &&
        !message.isTemp &&
        (!!message.sentenceCard || !!message.assistantCandidateId);
    // Phase 2: Whether to show speaker button
    const showSpeakerBtn = !isUser && !message.isTemp && !!message.assistantCandidateId;
    const isSpeakerPlaying = showSpeakerBtn && playingCandidateId === message.assistantCandidateId;
    const isSpeakerLoading = showSpeakerBtn && ttsLoadingCandidateId === message.assistantCandidateId;
    // Phase 3: Whether to show feedback button (for user messages)
    const showFeedbackBtn = isUser && !message.isTemp && !isEditing && !!onRequestFeedback;
    const showActionRow = showNav || showKnowledgeCardBtn || showSpeakerBtn || showFeedbackBtn;

    return (
        <div className="relative flex w-full min-w-0 flex-col">
            <div
                className={`flex max-w-full items-start gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}
            >
                {/* Avatar */}
                <Avatar className="h-9 w-9 rounded-lg overflow-hidden shrink-0">
                    {isUser ? (
                        <>
                            <AvatarImage src={userAvatar} alt="User" />
                            <AvatarFallback className="bg-gray-200 text-gray-600 text-xs">U</AvatarFallback>
                        </>
                    ) : (
                        <>
                            <AvatarImage src={assistantAvatar} alt="Assistant" />
                            <AvatarFallback className="bg-gray-200 text-gray-600 text-xs">AI</AvatarFallback>
                        </>
                    )}
                </Avatar>

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
                        className={`w-fit max-w-full min-h-9 flex items-center ${
                            isEditing
                                ? "bg-background shadow-md ring-1 ring-border rounded-2xl w-full min-w-[280px] sm:min-w-[400px]"
                                : `px-4 py-1.5 ${isUser ? "bubble-user" : "bubble-assistant"}`
                        }`}
                    >
                        {isEditing ? (
                            <div className="flex flex-col w-full py-1.5 px-3">
                                <Textarea
                                    value={draft}
                                    onChange={(e) => setDraft(e.target.value)}
                                    rows={3}
                                    className="min-h-[100px] max-h-[250px] overflow-y-auto w-full resize-none border-0 bg-transparent px-1 py-0 leading-normal focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none"
                                    style={messageTextStyle}
                                    disabled={actionsDisabled}
                                    placeholder="输入修改后的内容..."
                                />
                                <div className="flex items-center justify-end gap-3 mt-3">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-9 px-4 rounded-full text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                                        onClick={handleEditCancel}
                                        disabled={actionsDisabled}
                                    >
                                        取消
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="default"
                                        size="sm"
                                        className="h-9 px-4 rounded-full bg-[#0285ff] hover:bg-[#0285ff]/90 text-white shadow-md transition-all active:scale-95"
                                        onClick={handleEditSend}
                                        disabled={actionsDisabled || !draft.trim()}
                                    >
                                        发送
                                    </Button>
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

                            {/* Phase 3: Feedback button for user messages */}
                            {showFeedbackBtn && (
                                <button
                                    type="button"
                                    className={actionButtonClass}
                                    onClick={() => onRequestFeedback?.(message)}
                                    aria-label={feedbackStatus === "loading" ? "改进表达加载中" : "改进表达"}
                                >
                                    {feedbackStatus === "loading"
                                        ? renderLoadingSpinner()
                                        : renderActionIcon(ideaIcon)}
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
                                    onClick={() => onOpenKnowledgeCard?.(message)}
                                    disabled={knowledgeCardDisabled}
                                    aria-label={
                                        sentenceCardStatus === "loading"
                                            ? "知识卡加载中"
                                            : sentenceCardStatus === "error"
                                                ? "知识卡加载失败，点击重试"
                                                : "知识卡"
                                    }
                                >
                                    {sentenceCardStatus === "loading"
                                        ? renderLoadingSpinner()
                                        : renderActionIcon(knowledgeCardIcon)}
                                </button>
                            )}

                            {/* Phase 2: Speaker button for assistant messages (rightmost) */}
                            {showSpeakerBtn && (
                                <button
                                    type="button"
                                    className={actionButtonClass}
                                    onClick={() => {
                                        if (isRecording || ttsStreamingDisabled) return;
                                        if (isSpeakerPlaying) {
                                            onStopTts?.(message.assistantCandidateId!);
                                        } else {
                                            onPlayTts?.(message.assistantCandidateId!);
                                        }
                                    }}
                                    disabled={isRecording || ttsStreamingDisabled}
                                    aria-label={isSpeakerPlaying ? "停止朗读" : isSpeakerLoading ? "加载中" : "朗读"}
                                >
                                    <span className="flex h-8 w-8 items-center justify-center">
                                        {isSpeakerLoading ? (
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
                                            <svg
                                                xmlns="http://www.w3.org/2000/svg"
                                                viewBox="0 0 20 20"
                                                fill="none"
                                                aria-hidden="true"
                                                className={`h-5 w-5 shrink-0${isSpeakerPlaying ? " speaker-playing" : ""}`}
                                            >
                                                <path
                                                    className="speaker-body"
                                                    d="M9.751 4.092a.585.585 0 0 0-.907-.49l-.072.058-2.218 2.033a3.06 3.06 0 0 1-1.785.792l-.286.013c-.958 0-1.735.778-1.735 1.736v3.533c0 .958.777 1.734 1.735 1.734.766 0 1.506.288 2.071.806l2.218 2.033.072.057a.585.585 0 0 0 .907-.489zM11.081 15.908c0 1.615-1.859 2.483-3.091 1.512l-.118-.1-2.216-2.033a1.74 1.74 0 0 0-1.173-.456 3.065 3.065 0 0 1-3.065-3.064V8.234a3.065 3.065 0 0 1 3.065-3.066l.162-.008c.375-.035.73-.191 1.01-.448L7.873 2.68l.117-.1c1.233-.971 3.092-.102 3.092 1.512z"
                                                    fill="currentColor"
                                                />
                                                <path
                                                    className="speaker-wave wave1"
                                                    d="M12.5 7.5Q14.5 10 12.5 12.5"
                                                />
                                                <path
                                                    className="speaker-wave wave2"
                                                    d="M14.0 6.0Q17.0 10 14.0 14.0"
                                                />
                                                <path
                                                    className="speaker-wave wave3"
                                                    d="M15.5 4.5Q19.5 10 15.5 15.5"
                                                />
                                            </svg>
                                        )}
                                    </span>
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
