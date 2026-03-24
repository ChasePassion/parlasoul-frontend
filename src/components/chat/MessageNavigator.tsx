"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import type { Message } from "@/components/ChatMessage";
import { cn } from "@/lib/utils";

interface MessageNavigatorProps {
  messages: Message[];
  scrollRootRef: React.RefObject<HTMLDivElement | null>;
  isSidebarOpen?: boolean;
  className?: string;
}

interface NavigatorViewport {
  top: number;
  right: number;
  maxHeight: number;
  ready: boolean;
}

const EDGE_OFFSET = 16;
const MIN_MESSAGES = 3;
const PREVIEW_LENGTH = 30;
const LONG_HOVER_DELAY = 800;
const VIEWPORT_PADDING = 32;

export default function MessageNavigator({
  messages,
  scrollRootRef,
  isSidebarOpen = true,
  className,
}: MessageNavigatorProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [previewMessage, setPreviewMessage] = useState<Message | null>(null);
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [previewPosition, setPreviewPosition] = useState({ top: 0 });
  const [viewport, setViewport] = useState<NavigatorViewport>({
    top: 0,
    right: EDGE_OFFSET,
    maxHeight: 320,
    ready: false,
  });

  const longHoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const userMessages = useMemo(
    () => messages.filter((message) => message.role === "user" && !message.isTemp),
    [messages]
  );

  const clearLongHoverTimer = useCallback(() => {
    if (!longHoverTimerRef.current) {
      return;
    }
    clearTimeout(longHoverTimerRef.current);
    longHoverTimerRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      clearLongHoverTimer();
    };
  }, [clearLongHoverTimer]);

  useEffect(() => {
    const root = scrollRootRef.current;
    if (!root) {
      return;
    }

    const updateViewport = () => {
      const rect = root.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        setViewport((previous) =>
          previous.ready ? { ...previous, ready: false } : previous
        );
        return;
      }

      setViewport({
        top: rect.top + rect.height / 2,
        right: Math.max(window.innerWidth - rect.right + EDGE_OFFSET, EDGE_OFFSET),
        maxHeight: Math.max(220, rect.height - VIEWPORT_PADDING * 2),
        ready: true,
      });
    };

    updateViewport();

    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(() => {
            updateViewport();
          });

    resizeObserver?.observe(root);
    window.addEventListener("resize", updateViewport);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", updateViewport);
    };
  }, [isSidebarOpen, scrollRootRef, userMessages.length]);

  useEffect(() => {
    if (userMessages.length === 0) {
      setCurrentMessageIndex(0);
      return;
    }

    setCurrentMessageIndex((previous) =>
      Math.min(previous, userMessages.length - 1)
    );
  }, [userMessages.length]);

  useEffect(() => {
    const scrollRoot = scrollRootRef.current;
    if (!scrollRoot || userMessages.length === 0) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            return;
          }

          const turnId = entry.target.getAttribute("data-turn-id");
          if (!turnId) {
            return;
          }

          const index = userMessages.findIndex((message) => message.id === turnId);
          if (index !== -1) {
            setCurrentMessageIndex(index);
          }
        });
      },
      {
        root: scrollRoot,
        rootMargin: "-50% 0px -50% 0px",
        threshold: 0,
      }
    );

    userMessages.forEach((message) => {
      const element = scrollRoot.querySelector(`[data-turn-id="${message.id}"]`);
      if (element) {
        observer.observe(element);
      }
    });

    return () => observer.disconnect();
  }, [scrollRootRef, userMessages]);

  const scrollToMessage = useCallback(
    (messageId: string) => {
      const element = scrollRootRef.current?.querySelector(
        `[data-turn-id="${messageId}"]`
      );

      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
      }

      setIsExpanded(false);
      setPreviewMessage(null);
      clearLongHoverTimer();
    },
    [clearLongHoverTimer, scrollRootRef]
  );

  const handleMouseEnter = useCallback(() => {
    setIsExpanded(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsExpanded(false);
    setHoveredIndex(null);
    setPreviewMessage(null);
    clearLongHoverTimer();
  }, [clearLongHoverTimer]);

  const handleItemHover = useCallback(
    (
      index: number,
      message: Message,
      event: MouseEvent<HTMLButtonElement>
    ) => {
      setHoveredIndex(index);
      const buttonRect = event.currentTarget.getBoundingClientRect();
      setPreviewPosition({ top: buttonRect.top + buttonRect.height / 2 });

      clearLongHoverTimer();
      longHoverTimerRef.current = setTimeout(() => {
        setPreviewMessage(message);
      }, LONG_HOVER_DELAY);
    },
    [clearLongHoverTimer]
  );

  const handleItemLeave = useCallback(() => {
    setHoveredIndex(null);
    setPreviewMessage(null);
    clearLongHoverTimer();
  }, [clearLongHoverTimer]);

  const getPreviewText = useCallback((content: string) => {
    const cleanContent = content.replace(/\s+/g, " ").trim();
    if (cleanContent.length <= PREVIEW_LENGTH) {
      return cleanContent;
    }
    return `${cleanContent.slice(0, PREVIEW_LENGTH)}...`;
  }, []);

  if (userMessages.length < MIN_MESSAGES || !viewport.ready) {
    return null;
  }

  const panelHeight = Math.min(userMessages.length * 40 + 24, viewport.maxHeight);

  return (
    <>
      <div
        className={cn("fixed z-30", className)}
        style={{
          top: `${viewport.top}px`,
          right: `${viewport.right}px`,
          transform: "translateY(-50%)",
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div
          className={cn(
            "absolute right-0 top-1/2 -translate-y-1/2",
            "bg-white/95 backdrop-blur-sm rounded-l-xl",
            "border border-r-0 border-gray-200/80 shadow-lg",
            "transition-all duration-300 ease-out overflow-hidden",
            isExpanded ? "w-64 opacity-100" : "w-0 opacity-0"
          )}
          style={{ maxHeight: `${panelHeight}px` }}
        >
          <div
            className="py-3 px-2 space-y-0.5 overflow-y-auto message-navigator-scroll"
            style={{ maxHeight: `${panelHeight}px` }}
          >
            {userMessages.map((message, index) => {
              const isLatest = index === userMessages.length - 1;
              const isHovered = hoveredIndex === index;
              const isCurrent = index === currentMessageIndex;

              return (
                <button
                  key={message.id}
                  type="button"
                  onClick={() => scrollToMessage(message.id)}
                  onMouseEnter={(event) =>
                    handleItemHover(index, message, event)
                  }
                  onMouseLeave={handleItemLeave}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-lg text-sm",
                    "transition-all duration-200",
                    isLatest && !isHovered && "text-sky-500",
                    !isLatest && !isHovered && "text-gray-400",
                    isHovered && "text-gray-900 bg-gray-50",
                    isCurrent && !isHovered && "font-medium bg-gray-50/50"
                  )}
                >
                  <span className="line-clamp-1">
                    {getPreviewText(message.content)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div
          className={cn(
            "relative flex flex-col items-end gap-1.5 py-3 px-2 rounded-lg",
            "transition-all duration-300 cursor-pointer",
            "hover:bg-gray-100/50",
            isExpanded && "opacity-0 pointer-events-none"
          )}
          style={{ maxHeight: `${viewport.maxHeight}px` }}
        >
          {userMessages.map((_, index) => {
            const isCurrent = index === currentMessageIndex;

            return (
              <button
                key={index}
                type="button"
                aria-label={`跳转到第 ${index + 1} 条消息`}
                onClick={() => {
                  const message = userMessages[index];
                  if (message) {
                    scrollToMessage(message.id);
                  }
                }}
                className={cn(
                  "h-0.5 rounded-full transition-all duration-200",
                  isCurrent
                    ? "w-6 bg-sky-500"
                    : "w-3 bg-gray-300 hover:w-4 hover:bg-gray-400"
                )}
              />
            );
          })}
        </div>
      </div>

      {previewMessage && isExpanded ? (
        <div
          className={cn(
            "fixed z-40 max-w-xs pointer-events-none",
            "bg-gray-900 text-white text-sm",
            "px-4 py-3 rounded-xl shadow-xl",
            "animate-in fade-in zoom-in-95 duration-200"
          )}
          style={{
            top: `${previewPosition.top}px`,
            right: `${viewport.right + 272}px`,
            transform: "translateY(-50%)",
          }}
        >
          <p className="line-clamp-4">{previewMessage.content}</p>
          <div
            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1"
            style={{
              width: 0,
              height: 0,
              borderTop: "6px solid transparent",
              borderBottom: "6px solid transparent",
              borderLeft: "6px solid rgb(17, 24, 39)",
            }}
          />
        </div>
      ) : null}
    </>
  );
}
