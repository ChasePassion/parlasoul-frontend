"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type RefObject,
} from "react";
import type { Message } from "@/components/ChatMessage";
import { cn } from "@/lib/utils";

interface MessageNavigatorProps {
  messages: Message[];
  scrollRootRef: RefObject<HTMLDivElement | null>;
  isSidebarOpen?: boolean;
  className?: string;
}

interface NavigatorViewport {
  top: number;
  right: number;
  maxHeight: number;
  ready: boolean;
}

interface NavigatorItem {
  id: string;
  label: string;
  preview: string;
}

const COLLAPSED_WIDTH = 44;
const EXPANDED_WIDTH = 240;
const EDGE_OFFSET = 16;
const HOVER_PREVIEW_DELAY = 600;
const ITEM_HEIGHT = 38;
const MIN_MESSAGES = 3;
const NAVIGATOR_GUTTER_OFFSET = 20;
const VIEWPORT_PADDING = 32;

function normalizeNavigatorLabel(content: string): string {
  const compactContent = content.replace(/\s+/g, " ").trim();
  return compactContent.length > 0 ? compactContent : "空白消息";
}

export default function MessageNavigator({
  messages,
  scrollRootRef,
  isSidebarOpen = true,
  className,
}: MessageNavigatorProps) {
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [previewItemId, setPreviewItemId] = useState<string | null>(null);
  const [previewTop, setPreviewTop] = useState(0);
  const [viewport, setViewport] = useState<NavigatorViewport>({
    top: 0,
    right: EDGE_OFFSET,
    maxHeight: 320,
    ready: false,
  });

  const hoverPreviewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const itemRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  const userMessages = useMemo(
    () => messages.filter((message) => message.role === "user" && !message.isTemp),
    [messages]
  );

  const navigationItems = useMemo<NavigatorItem[]>(
    () =>
      userMessages.map((message) => {
        const normalizedLabel = normalizeNavigatorLabel(message.content);
        return {
          id: message.id,
          label: normalizedLabel,
          preview: message.content.trim().length > 0 ? message.content : normalizedLabel,
        };
      }),
    [userMessages]
  );

  const clearHoverPreviewTimer = useCallback(() => {
    if (!hoverPreviewTimerRef.current) {
      return;
    }

    clearTimeout(hoverPreviewTimerRef.current);
    hoverPreviewTimerRef.current = null;
  }, []);

  const resetHoverState = useCallback(() => {
    clearHoverPreviewTimer();
    setHoveredIndex(null);
    setPreviewItemId(null);
  }, [clearHoverPreviewTimer]);

  useEffect(() => {
    return () => {
      clearHoverPreviewTimer();
    };
  }, [clearHoverPreviewTimer]);

  useEffect(() => {
    const root = scrollRootRef.current;
    if (!root) {
      return;
    }

    const updateViewport = () => {
      const rect = root.getBoundingClientRect();
      const scrollbarWidth = Math.max(0, root.offsetWidth - root.clientWidth);
      const rightInset =
        window.innerWidth - rect.right + EDGE_OFFSET + scrollbarWidth + NAVIGATOR_GUTTER_OFFSET;

      if (rect.width === 0 || rect.height === 0) {
        setViewport((previous) =>
          previous.ready ? { ...previous, ready: false } : previous
        );
        return;
      }

      setViewport({
        top: rect.top + rect.height / 2,
        right: Math.max(rightInset, EDGE_OFFSET + NAVIGATOR_GUTTER_OFFSET),
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
  }, [isSidebarOpen, navigationItems.length, scrollRootRef]);

  useEffect(() => {
    if (navigationItems.length === 0) {
      setCurrentMessageIndex(0);
      return;
    }

    setCurrentMessageIndex((previous) =>
      Math.min(previous, navigationItems.length - 1)
    );
  }, [navigationItems.length]);

  useEffect(() => {
    const scrollRoot = scrollRootRef.current;
    if (!scrollRoot || navigationItems.length === 0) {
      return;
    }

    const indexById = new Map(
      navigationItems.map((item, index) => [item.id, index] as const)
    );

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

          const nextIndex = indexById.get(turnId);
          if (nextIndex === undefined) {
            return;
          }

          setCurrentMessageIndex((previous) =>
            previous === nextIndex ? previous : nextIndex
          );
        });
      },
      {
        root: scrollRoot,
        rootMargin: "-10% 0px -80% 0px",
        threshold: 0,
      }
    );

    navigationItems.forEach((item) => {
      const element = scrollRoot.querySelector(`[data-turn-id="${item.id}"]`);
      if (element) {
        observer.observe(element);
      }
    });

    return () => observer.disconnect();
  }, [navigationItems, scrollRootRef]);

  useEffect(() => {
    const activeItem = navigationItems[currentMessageIndex];
    if (!activeItem) {
      return;
    }

    itemRefs.current.get(activeItem.id)?.scrollIntoView({
      block: "nearest",
      inline: "nearest",
    });
  }, [currentMessageIndex, navigationItems]);

  const scrollToMessage = useCallback(
    (messageId: string) => {
      const element = scrollRootRef.current?.querySelector(
        `[data-turn-id="${messageId}"]`
      );

      if (element) {
        element.scrollIntoView({ behavior: "auto", block: "start" });
      }
    },
    [scrollRootRef]
  );

  const focusItem = useCallback(
    (index: number) => {
      const targetItem = navigationItems[index];
      if (!targetItem) {
        return;
      }

      itemRefs.current.get(targetItem.id)?.focus();
    },
    [navigationItems]
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (navigationItems.length === 0) {
        return;
      }

      const pressedKey = event.key;
      const targetElement = event.target instanceof Element ? event.target : null;
      const targetButton = targetElement?.closest("[data-navigator-index]");
      const targetIndex =
        targetButton instanceof HTMLElement
          ? Number(targetButton.getAttribute("data-navigator-index"))
          : Number.NaN;
      const startIndex = Number.isFinite(targetIndex)
        ? targetIndex
        : currentMessageIndex;

      if (pressedKey === "Enter" || pressedKey === " ") {
        if (event.target === event.currentTarget) {
          event.preventDefault();
          const activeItem = navigationItems[currentMessageIndex];
          if (activeItem) {
            scrollToMessage(activeItem.id);
          }
        }
        return;
      }

      let nextIndex = startIndex;

      if (pressedKey === "ArrowDown") {
        nextIndex = Math.min(startIndex + 1, navigationItems.length - 1);
      } else if (pressedKey === "ArrowUp") {
        nextIndex = Math.max(startIndex - 1, 0);
      } else if (pressedKey === "Home") {
        nextIndex = 0;
      } else if (pressedKey === "End") {
        nextIndex = navigationItems.length - 1;
      } else {
        return;
      }

      event.preventDefault();
      focusItem(nextIndex);
    },
    [currentMessageIndex, focusItem, navigationItems, scrollToMessage]
  );

  const handleNavigatorEnter = useCallback(() => {
    setIsExpanded(true);
  }, []);

  const handleNavigatorLeave = useCallback(() => {
    setIsExpanded(false);
    resetHoverState();
  }, [resetHoverState]);

  const handleItemEnter = useCallback(
    (
      index: number,
      item: NavigatorItem,
      event: MouseEvent<HTMLButtonElement>
    ) => {
      const buttonRect = event.currentTarget.getBoundingClientRect();
      const navigatorRoot = event.currentTarget.closest("[data-message-navigator-root]");
      const navigatorRect = navigatorRoot?.getBoundingClientRect();

      setHoveredIndex(index);
      setPreviewTop(
        navigatorRect
          ? buttonRect.top - navigatorRect.top + buttonRect.height / 2
          : buttonRect.top + buttonRect.height / 2
      );
      clearHoverPreviewTimer();
      setPreviewItemId(null);

      if (index === currentMessageIndex) {
        return;
      }

      hoverPreviewTimerRef.current = setTimeout(() => {
        setPreviewItemId(item.id);
      }, HOVER_PREVIEW_DELAY);
    },
    [clearHoverPreviewTimer, currentMessageIndex]
  );

  if (navigationItems.length < MIN_MESSAGES || !viewport.ready) {
    return null;
  }

  const previewItem =
    previewItemId === null
      ? null
      : navigationItems.find((item) => item.id === previewItemId) ?? null;

  const panelHeight = Math.min(
    navigationItems.length * ITEM_HEIGHT,
    viewport.maxHeight
  );

  return (
    <aside
      className={cn("fixed z-30", className)}
      data-message-navigator-root
      style={{
        top: `${viewport.top}px`,
        right: `${viewport.right}px`,
        transform: "translateY(-50%)",
      }}
      aria-label="消息导航"
      onMouseEnter={handleNavigatorEnter}
      onMouseLeave={handleNavigatorLeave}
    >
        <div
          className={cn(
            "relative overflow-hidden transition-[width,background-color,border-color,box-shadow] duration-220 ease-out",
            isExpanded
              ? "rounded-[24px] border border-black/6 bg-white/96 shadow-[0_18px_48px_rgba(15,23,42,0.12)] backdrop-blur-xl"
              : "rounded-[20px] border border-transparent bg-transparent shadow-none"
        )}
        style={{
          width: `${isExpanded ? EXPANDED_WIDTH : COLLAPSED_WIDTH}px`,
          maxHeight: `${panelHeight}px`,
        }}
      >
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-white via-white/90 to-transparent transition-opacity duration-150",
            isExpanded ? "h-11 opacity-100" : "h-0 opacity-0"
          )}
        />
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-white via-white/90 to-transparent transition-opacity duration-150",
            isExpanded ? "h-11 opacity-100" : "h-0 opacity-0"
          )}
        />

        <div
          className={cn(
            "message-navigator-scroll relative overflow-y-auto outline-none",
            !isExpanded && "message-navigator-scroll-collapsed"
          )}
          style={{ maxHeight: `${panelHeight}px` }}
          tabIndex={0}
          onKeyDown={handleKeyDown}
        >
          <div className="flex flex-col gap-1">
            {navigationItems.map((item, index) => {
              const isCurrent = index === currentMessageIndex;
              const isHovered = hoveredIndex === index;
              const showHoveredState = isHovered && !isCurrent;

              return (
                <button
                  key={item.id}
                  ref={(element) => {
                    if (element) {
                      itemRefs.current.set(item.id, element);
                    } else {
                      itemRefs.current.delete(item.id);
                    }
                  }}
                  type="button"
                  data-navigator-index={index}
                  aria-current={isCurrent ? "true" : undefined}
                  aria-label={`跳转到第 ${index + 1} 条用户消息`}
                  onClick={() => scrollToMessage(item.id)}
                  onMouseEnter={(event) => handleItemEnter(index, item, event)}
                  className={cn(
                    "group relative flex h-[34px] w-full items-center rounded-[14px] text-left outline-none transition-colors duration-150",
                    isCurrent
                      ? "bg-transparent"
                      : showHoveredState
                        ? "bg-transparent"
                        : "bg-transparent",
                    "focus-visible:ring-2 focus-visible:ring-[#3964FE]/20"
                  )}
                >
                  <span
                    className={cn(
                      "min-w-0 flex-1 overflow-hidden whitespace-nowrap pr-11 text-[13px] leading-5 transition-[opacity,color,transform,max-width,padding] duration-180",
                      isExpanded
                        ? "max-w-full translate-x-0 px-3 opacity-100"
                        : "max-w-0 translate-x-0 px-0 opacity-0",
                      isCurrent
                        ? "font-medium text-[#3964FE]"
                        : showHoveredState
                          ? "text-[#111111]"
                          : "text-[#8F8F8F]"
                    )}
                  >
                    <span className="block truncate">{item.label}</span>
                  </span>

                  <span className="absolute inset-y-0 right-0 flex w-[44px] items-center justify-center">
                    <span
                      className={cn(
                        "rounded-full transition-[width,background-color] duration-150",
                        isCurrent
                          ? "h-1.5 w-5 bg-[#3964FE]"
                          : showHoveredState
                            ? "h-1 w-4 bg-[#111111]"
                            : "h-0.5 w-3 bg-black/20"
                      )}
                    />
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {isExpanded && previewItem && hoveredIndex !== currentMessageIndex ? (
        <div
          className="absolute right-[calc(100%+12px)] z-10 w-[320px] max-w-[min(320px,42vw)]"
          style={{
            top: `${previewTop}px`,
            transform: "translateY(-50%)",
          }}
        >
          <div className="rounded-[18px] bg-[#1F1F1F] px-4 py-3 text-white shadow-[0_14px_30px_rgba(0,0,0,0.22)]">
            <p className="max-h-[50vh] overflow-y-auto whitespace-pre-wrap break-words pr-1 text-[13px] leading-6">
              {previewItem.preview}
            </p>
          </div>
        </div>
      ) : null}
    </aside>
  );
}
