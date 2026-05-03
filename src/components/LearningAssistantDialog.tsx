"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Copy, Sparkles, X } from "lucide-react";
import { SpriteIcon } from "@/components/ui/sprite-icon";

import Markdown from "@/components/Markdown";
import { Textarea } from "@/components/ui/textarea";
import type { LearningAssistantContextMessage } from "@/lib/api";
import { copyToClipboard } from "@/lib/clipboard";
import { useLearningAssistant } from "@/hooks/useLearningAssistant";

interface LearningAssistantDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chatContext: LearningAssistantContextMessage[];
  chatId?: string;
}

interface DialogRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

type InteractionState =
  | {
      type: "drag";
      startPointerX: number;
      startPointerY: number;
      startRect: DialogRect;
    }
  | {
      type: "resize";
      direction: "top-left" | "top-right" | "bottom-left" | "bottom-right";
      startPointerX: number;
      startPointerY: number;
      startRect: DialogRect;
    };

const STORAGE_KEY = "learning-assistant-dialog-state";
const VIEWPORT_PADDING = 16;
const DEFAULT_WIDTH = 620;
const DEFAULT_HEIGHT = 660;
const MIN_WIDTH = 400;
const MIN_HEIGHT = 420;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function areRectsEqual(a: DialogRect | null, b: DialogRect | null) {
  if (!a || !b) return false;
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}

function getViewport() {
  if (typeof window === "undefined") {
    return { width: 1440, height: 900 };
  }
  return {
    width: window.innerWidth,
    height: window.innerHeight,
  };
}

function buildMaxBounds(viewport: { width: number; height: number }) {
  return {
    maxWidth: Math.max(360, viewport.width - VIEWPORT_PADDING * 2),
    maxHeight: Math.max(360, viewport.height - VIEWPORT_PADDING * 2),
  };
}

function clampDialogRect(rect: DialogRect, viewport: { width: number; height: number }): DialogRect {
  const { maxWidth, maxHeight } = buildMaxBounds(viewport);
  const minWidth = Math.min(MIN_WIDTH, maxWidth);
  const minHeight = Math.min(MIN_HEIGHT, maxHeight);
  const width = clamp(rect.width, minWidth, maxWidth);
  const height = clamp(rect.height, minHeight, maxHeight);
  const x = clamp(rect.x, VIEWPORT_PADDING, viewport.width - VIEWPORT_PADDING - width);
  const y = clamp(rect.y, VIEWPORT_PADDING, viewport.height - VIEWPORT_PADDING - height);

  return { x, y, width, height };
}

function resizeDialogFromCorner(
  direction: "top-left" | "top-right" | "bottom-left" | "bottom-right",
  startRect: DialogRect,
  deltaX: number,
  deltaY: number,
  viewport: { width: number; height: number },
): DialogRect {
  const { maxWidth, maxHeight } = buildMaxBounds(viewport);
  const minWidth = Math.min(MIN_WIDTH, maxWidth);
  const minHeight = Math.min(MIN_HEIGHT, maxHeight);
  const left = startRect.x;
  const right = startRect.x + startRect.width;
  const top = startRect.y;
  const bottom = startRect.y + startRect.height;

  let nextX = left;
  let nextY = top;
  let nextWidth = startRect.width;
  let nextHeight = startRect.height;

  if (direction === "top-left" || direction === "bottom-left") {
    nextX = clamp(left + deltaX, VIEWPORT_PADDING, right - minWidth);
    nextWidth = right - nextX;
  } else {
    nextWidth = clamp(startRect.width + deltaX, minWidth, maxWidth);
  }

  if (direction === "top-left" || direction === "top-right") {
    nextY = clamp(top + deltaY, VIEWPORT_PADDING, bottom - minHeight);
    nextHeight = bottom - nextY;
  } else {
    nextHeight = clamp(startRect.height + deltaY, minHeight, maxHeight);
  }

  return clampDialogRect(
    {
      x: nextX,
      y: nextY,
      width: nextWidth,
      height: nextHeight,
    },
    viewport,
  );
}

function createCenteredRect(viewport: { width: number; height: number }): DialogRect {
  const { maxWidth, maxHeight } = buildMaxBounds(viewport);
  const width = Math.min(DEFAULT_WIDTH, maxWidth);
  const height = Math.min(DEFAULT_HEIGHT, maxHeight);

  return clampDialogRect(
    {
      x: (viewport.width - width) / 2,
      y: (viewport.height - height) / 2,
      width,
      height,
    },
    viewport,
  );
}

function readStoredRect(): DialogRect | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DialogRect>;
    if (
      typeof parsed.x !== "number" ||
      typeof parsed.y !== "number" ||
      typeof parsed.width !== "number" ||
      typeof parsed.height !== "number"
    ) {
      return null;
    }
    return parsed as DialogRect;
  } catch {
    return null;
  }
}

function persistRect(rect: DialogRect) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rect));
}

export default function LearningAssistantDialog({
  open,
  onOpenChange,
  chatContext,
  chatId,
}: LearningAssistantDialogProps) {
  const [question, setQuestion] = useState("");
  const [rect, setRect] = useState<DialogRect | null>(null);
  const [interaction, setInteraction] = useState<InteractionState | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const { messages, isStreaming, ask, stop, reset } = useLearningAssistant();
  const windowRef = useRef<HTMLDivElement | null>(null);
  const rectRef = useRef<DialogRect | null>(null);
  const rafRef = useRef<number | null>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const applyRect = useCallback((nextRect: DialogRect) => {
    rectRef.current = nextRect;
    const node = windowRef.current;
    if (!node) return;
    node.style.transform = `translate3d(${nextRect.x}px, ${nextRect.y}px, 0)`;
    node.style.width = `${nextRect.width}px`;
    node.style.height = `${nextRect.height}px`;
  }, []);

  const flushRect = useCallback(
    (nextRect: DialogRect) => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
      rafRef.current = requestAnimationFrame(() => {
        applyRect(nextRect);
      });
    },
    [applyRect],
  );

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const viewport = getViewport();
    const currentRect = rectRef.current ?? readStoredRect() ?? createCenteredRect(viewport);
    const nextRect = clampDialogRect(currentRect, viewport);
    setRect((previousRect) => (areRectsEqual(previousRect, nextRect) ? previousRect : nextRect));
    applyRect(nextRect);
  }, [applyRect, open]);

  const handleClose = useCallback(() => {
    const currentRect = rectRef.current ?? rect;
    if (currentRect) {
      persistRect(currentRect);
    }
    setInteraction(null);
    onOpenChange(false);
  }, [onOpenChange, rect]);

  useEffect(() => {
    if (!open) return;

    const handleResize = () => {
      const current = rectRef.current ?? rect;
      if (!current) return;
      const nextRect = clampDialogRect(current, getViewport());
      setRect(nextRect);
      applyRect(nextRect);
      persistRect(nextRect);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        handleClose();
      }
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [applyRect, handleClose, open, rect]);

  useEffect(() => {
    if (!open || !interaction) return;

    const handlePointerMove = (event: PointerEvent) => {
      const currentRect = rectRef.current ?? interaction.startRect;
      const deltaX = event.clientX - interaction.startPointerX;
      const deltaY = event.clientY - interaction.startPointerY;

      const nextRect =
        interaction.type === "drag"
          ? clampDialogRect(
              {
                ...currentRect,
                x: interaction.startRect.x + deltaX,
                y: interaction.startRect.y + deltaY,
              },
              getViewport(),
            )
          : resizeDialogFromCorner(
              interaction.direction,
              interaction.startRect,
              deltaX,
              deltaY,
              getViewport(),
            );

      flushRect(nextRect);
    };

    const handlePointerUp = () => {
      const nextRect = rectRef.current;
      if (nextRect) {
        setRect(nextRect);
        persistRect(nextRect);
      }
      setInteraction(null);
    };

    const previousUserSelect = document.body.style.userSelect;
    document.body.style.userSelect = "none";

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("pointerup", handlePointerUp, { passive: true });
    window.addEventListener("pointercancel", handlePointerUp, { passive: true });

    return () => {
      document.body.style.userSelect = previousUserSelect;
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [flushRect, interaction, open]);

  const handleDragStart = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const currentRect = rectRef.current ?? rect;
      if (!currentRect) return;
      if (event.pointerType === "mouse" && event.button !== 0) return;
      event.preventDefault();
      setInteraction({
        type: "drag",
        startPointerX: event.clientX,
        startPointerY: event.clientY,
        startRect: currentRect,
      });
    },
    [rect],
  );

  const handleResizeStart = useCallback(
    (
      event: React.PointerEvent<HTMLButtonElement>,
      direction: "top-left" | "top-right" | "bottom-left" | "bottom-right",
    ) => {
      const currentRect = rectRef.current ?? rect;
      if (!currentRect) return;
      if (event.pointerType === "mouse" && event.button !== 0) return;
      event.preventDefault();
      setInteraction({
        type: "resize",
        direction,
        startPointerX: event.clientX,
        startPointerY: event.clientY,
        startRect: currentRect,
      });
    },
    [rect],
  );

  const handleSubmit = useCallback(async () => {
    const normalizedQuestion = question.trim();
    if (!normalizedQuestion) return;
    setQuestion("");
    await ask({
      question: normalizedQuestion,
      characterChatContext: chatContext,
      chatId,
    });
  }, [ask, chatContext, chatId, question]);

  const handleCopyAnswer = useCallback(async (messageId: string, content: string) => {
    const copied = await copyToClipboard(content);
    if (!copied) return;
    setCopiedMessageId(messageId);
    if (copyTimerRef.current) {
      clearTimeout(copyTimerRef.current);
    }
    copyTimerRef.current = setTimeout(() => {
      setCopiedMessageId(null);
    }, 1500);
  }, []);

  if (!open || !rect) {
    return null;
  }
  return (
    <>
      <div
        ref={windowRef}
        role="dialog"
        aria-label="AI智能助教"
        className="fixed top-0 left-0 z-40 flex flex-col overflow-hidden rounded-2xl border border-black/8 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] shadow-[0_18px_55px_rgba(22,37,66,0.16)]"
        style={{
          width: rect.width,
          height: rect.height,
          maxHeight: `calc(100vh - ${VIEWPORT_PADDING * 2}px)`,
          transform: `translate3d(${rect.x}px, ${rect.y}px, 0)`,
        }}
      >
        <div className="relative flex items-center justify-end border-b border-black/6 px-4 py-3">
          <div
            className="absolute top-2 left-1/2 flex -translate-x-1/2 cursor-grab touch-none select-none flex-col items-center gap-1 active:cursor-grabbing"
            onPointerDown={handleDragStart}
          >
            <div className="h-1.5 w-16 rounded-full bg-black/12" />
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
              <Sparkles className="h-4 w-4 text-[#3964FE]" />
              <span>AI智能助教</span>
            </div>
          </div>

          <button
            type="button"
            onClick={reset}
            className="mr-2 flex h-9 w-9 items-center justify-center rounded-lg border border-divider bg-white transition-colors hover:bg-sidebar-hover"
            aria-label="新建助教会话"
          >
            <SpriteIcon name="edit-square" size={18} />
          </button>

          <button
            type="button"
            onClick={handleClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-black/5 hover:text-gray-700"
            aria-label="关闭AI智能助教"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            <div className="space-y-4">
              {messages.map((message) =>
                message.role === "user" ? (
                  <div key={message.id} className="flex justify-end">
                    <div
                      className="max-w-[82%] rounded-[10px] px-4 py-2 text-sm leading-6 text-[var(--text-primary)]"
                      style={{
                        backgroundColor: "var(--user-bubble)",
                        filter: "var(--chat-bubble-shadow)",
                      }}
                    >
                      {message.content}
                    </div>
                  </div>
                ) : (
                  <div key={message.id} className="relative space-y-3 pr-1 pb-10 text-sm leading-7 text-gray-800">
                    <div className="text-black">
                      <Markdown content={message.content} variant="assistant" />
                    </div>

                    {message.status === "streaming" && !message.content.trim() ? (
                      <div className="flex items-center gap-2 text-sm">
                        <Sparkles className="h-4 w-4 shrink-0 text-[#3964FE]" />
                        <span className="relative inline-block overflow-hidden text-gray-500">
                          <span
                            className="pointer-events-none absolute inset-0 -translate-x-[130%] bg-gradient-to-r from-transparent via-white/95 to-transparent animate-assistant-shimmer"
                            aria-hidden="true"
                          />
                          <span className="relative">思考中...</span>
                        </span>
                      </div>
                    ) : null}

                    {message.content ? (
                      <button
                        type="button"
                        onClick={() => {
                          void handleCopyAnswer(message.id, message.content);
                        }}
                        className="absolute right-0 bottom-0 inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-black/5 hover:text-gray-700"
                        aria-label={copiedMessageId === message.id ? "已复制" : "复制回答"}
                      >
                        {copiedMessageId === message.id ? (
                          <Check className="h-3.5 w-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                    ) : null}
                  </div>
                ),
              )}
            </div>
          </div>

          <div className="border-t border-black/6 bg-white/88 px-4 py-3 backdrop-blur-sm">
            <div className="flex items-start gap-2 rounded-[10px] bg-[#F4F7FB] px-2 py-1.5">
              <Textarea
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    if (isStreaming) {
                      stop();
                      return;
                    }
                    void handleSubmit();
                  }
                }}
                rows={1}
                placeholder="询问任何问题"
                className="max-h-32 min-h-[32px] flex-1 resize-none overflow-y-auto border-transparent bg-transparent py-1.5 pr-1 pl-1.5 text-sm leading-5 shadow-none focus-visible:border-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
              />

              {isStreaming ? (
                <button
                  type="button"
                  onClick={stop}
                  aria-label="暂停生成"
                  className="composer-submit-button-color text-submit-btn-text flex h-9 w-9 shrink-0 items-center justify-center rounded-full hover:opacity-70 focus-visible:outline-black focus-visible:outline-none disabled:text-[#f4f4f4] disabled:opacity-30 dark:focus-visible:outline-white"
                >
                  <span className="rounded-[3px] bg-white" style={{ width: "16px", height: "16px" }} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    void handleSubmit();
                  }}
                  disabled={!question.trim()}
                  aria-label="发送问题"
                  className="composer-submit-button-color text-submit-btn-text flex h-9 w-9 shrink-0 items-center justify-center rounded-full hover:opacity-70 focus-visible:outline-black focus-visible:outline-none disabled:text-[#f4f4f4] disabled:opacity-30 dark:focus-visible:outline-white"
                >
                  <SpriteIcon name="laptop" size={20} className="brightness-0 invert" />
                </button>
              )}
            </div>
          </div>
        </div>

        <button
          type="button"
          onPointerDown={(event) => handleResizeStart(event, "bottom-right")}
          className="absolute right-0 bottom-0 flex h-8 w-8 touch-none cursor-nwse-resize items-end justify-end"
          aria-label="右下角调整AI智能助教大小"
        >
          <SpriteIcon name="resize-corner" size={32} className="pointer-events-none h-8 w-8 opacity-70" />
        </button>
      </div>
    </>
  );
}
