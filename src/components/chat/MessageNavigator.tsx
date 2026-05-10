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

interface RailHighlightState {
  activeIndex: number;
  fromIndex: number;
  toIndex: number;
  progress: number;
}

const COLLAPSED_WIDTH = 44;
const EXPANDED_WIDTH = 240;
const EDGE_OFFSET = 4;
const HOVER_PREVIEW_DELAY = 600;

const HIGHLIGHT_SYNC_TOP_OFFSET = 20;
const CLICK_SCROLL_TOP_GAP = 16;
const MIN_MESSAGES = 7;
const NAVIGATOR_MAX_HEIGHT = 360;
const PREVIEW_GAP = 12;
const PREVIEW_MAX_WIDTH = 320;
const VIEWPORT_PADDING = 32;
const RAIL_BASE_WIDTH = 16;
const RAIL_ACTIVE_WIDTH = 20;
const RAIL_BASE_HEIGHT = 2;
const RAIL_ACTIVE_HEIGHT = 6;

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
  const [highlightState, setHighlightState] = useState<RailHighlightState>({
    activeIndex: 0,
    fromIndex: 0,
    toIndex: 0,
    progress: 1,
  });
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
  const [isMobile, setIsMobile] = useState(false);

  const hoverPreviewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const highlightSyncFrameRef = useRef<number | null>(null);
  const itemRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const scrollContainerRef = useRef<HTMLDivElement>(null);

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
      if (highlightSyncFrameRef.current !== null) {
        cancelAnimationFrame(highlightSyncFrameRef.current);
      }
    };
  }, [clearHoverPreviewTimer]);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 799px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const getMessageElement = useCallback(
    (messageId: string) => {
      return scrollRootRef.current?.querySelector<HTMLElement>(
        `[data-turn-id="${messageId}"]`
      ) ?? null;
    },
    [scrollRootRef]
  );

  const getHeaderOffset = useCallback((root: HTMLDivElement) => {
    const headerHeightValue = window
      .getComputedStyle(root)
      .getPropertyValue("--header-height")
      .trim();
    const headerHeight = Number.parseFloat(headerHeightValue);
    return Number.isFinite(headerHeight) ? headerHeight : 0;
  }, []);

  const getScrollBehavior = useCallback((): ScrollBehavior => {
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return "auto";
    }

    return "smooth";
  }, []);

  const syncHighlightState = useCallback(() => {
    const root = scrollRootRef.current;
    if (!root || navigationItems.length === 0) {
      return;
    }

    const activationLine =
      root.getBoundingClientRect().top +
      getHeaderOffset(root) +
      HIGHLIGHT_SYNC_TOP_OFFSET;
    const anchors = navigationItems.flatMap((item, index) => {
      const element = getMessageElement(item.id);
      if (!element) {
        return [];
      }

      const elementRect = element.getBoundingClientRect();
      return [
        {
          index,
          messageMiddle: elementRect.top + elementRect.height / 2,
        },
      ];
    });

    if (anchors.length === 0) {
      return;
    }

    let nextHighlightState: RailHighlightState;

    if (activationLine <= anchors[0].messageMiddle) {
      nextHighlightState = {
        activeIndex: anchors[0].index,
        fromIndex: anchors[0].index,
        toIndex: anchors[0].index,
        progress: 1,
      };
    } else {
      const lastAnchor = anchors[anchors.length - 1];

      if (activationLine >= lastAnchor.messageMiddle) {
        nextHighlightState = {
          activeIndex: lastAnchor.index,
          fromIndex: lastAnchor.index,
          toIndex: lastAnchor.index,
          progress: 1,
        };
      } else {
        nextHighlightState = {
          activeIndex: anchors[0].index,
          fromIndex: anchors[0].index,
          toIndex: anchors[0].index,
          progress: 1,
        };

        for (let index = 0; index < anchors.length - 1; index += 1) {
          const currentAnchor = anchors[index];
          const nextAnchor = anchors[index + 1];

          if (activationLine > nextAnchor.messageMiddle) {
            continue;
          }

          const distance = nextAnchor.messageMiddle - currentAnchor.messageMiddle;
          const rawProgress =
            distance <= 0
              ? 1
              : (activationLine - currentAnchor.messageMiddle) / distance;
          const progress = Math.min(Math.max(rawProgress, 0), 1);

          nextHighlightState = {
            activeIndex:
              progress < 0.5 ? currentAnchor.index : nextAnchor.index,
            fromIndex: currentAnchor.index,
            toIndex: nextAnchor.index,
            progress,
          };
          break;
        }
      }
    }

    setHighlightState((previous) => {
      if (
        previous.activeIndex === nextHighlightState.activeIndex &&
        previous.fromIndex === nextHighlightState.fromIndex &&
        previous.toIndex === nextHighlightState.toIndex &&
        Math.abs(previous.progress - nextHighlightState.progress) < 0.001
      ) {
        return previous;
      }

      return nextHighlightState;
    });
  }, [getHeaderOffset, getMessageElement, navigationItems, scrollRootRef]);

  const scheduleCurrentMessageSync = useCallback(() => {
    if (highlightSyncFrameRef.current !== null) {
      cancelAnimationFrame(highlightSyncFrameRef.current);
    }

    highlightSyncFrameRef.current = requestAnimationFrame(() => {
      highlightSyncFrameRef.current = null;
      syncHighlightState();
    });
  }, [syncHighlightState]);

  useEffect(() => {
    const root = scrollRootRef.current;
    if (!root) {
      return;
    }

    const updateViewport = () => {
      const rect = root.getBoundingClientRect();
      const scrollbarWidth = Math.max(0, root.offsetWidth - root.clientWidth);
      const rightInset =
        window.innerWidth - rect.right + EDGE_OFFSET + scrollbarWidth;

      if (rect.width === 0 || rect.height === 0) {
        setViewport((previous) =>
          previous.ready ? { ...previous, ready: false } : previous
        );
        return;
      }

      setViewport({
        top: rect.top + rect.height / 2,
        right: Math.max(rightInset, EDGE_OFFSET),
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
      setHighlightState({
        activeIndex: 0,
        fromIndex: 0,
        toIndex: 0,
        progress: 1,
      });
      return;
    }

    setHighlightState((previous) => ({
      activeIndex: Math.min(previous.activeIndex, navigationItems.length - 1),
      fromIndex: Math.min(previous.fromIndex, navigationItems.length - 1),
      toIndex: Math.min(previous.toIndex, navigationItems.length - 1),
      progress: previous.progress,
    }));
  }, [navigationItems.length]);

  useEffect(() => {
    const scrollRoot = scrollRootRef.current;
    if (!scrollRoot || navigationItems.length === 0) {
      return;
    }

    scheduleCurrentMessageSync();

    scrollRoot.addEventListener("scroll", scheduleCurrentMessageSync, {
      passive: true,
    });
    window.addEventListener("resize", scheduleCurrentMessageSync);

    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(() => {
            scheduleCurrentMessageSync();
          });

    resizeObserver?.observe(scrollRoot);

    return () => {
      scrollRoot.removeEventListener("scroll", scheduleCurrentMessageSync);
      window.removeEventListener("resize", scheduleCurrentMessageSync);
      resizeObserver?.disconnect();

      if (highlightSyncFrameRef.current !== null) {
        cancelAnimationFrame(highlightSyncFrameRef.current);
        highlightSyncFrameRef.current = null;
      }
    };
  }, [navigationItems, scheduleCurrentMessageSync, scrollRootRef]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    const activeItem = navigationItems[highlightState.activeIndex];
    if (!container || !activeItem) {
      return;
    }

    const itemElement = itemRefs.current.get(activeItem.id);
    if (!itemElement) {
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const itemRect = itemElement.getBoundingClientRect();

    if (itemRect.top < containerRect.top) {
      container.scrollTop += itemRect.top - containerRect.top;
    } else if (itemRect.bottom > containerRect.bottom) {
      container.scrollTop += itemRect.bottom - containerRect.bottom;
    }
  }, [highlightState.activeIndex, isExpanded, navigationItems]);

  const scrollToMessage = useCallback(
    (messageId: string) => {
      const root = scrollRootRef.current;
      const element = getMessageElement(messageId);
      if (!root || !element) {
        return;
      }

      const rootRect = root.getBoundingClientRect();
      const elementRect = element.getBoundingClientRect();
      const targetTop =
        root.scrollTop +
        (elementRect.top - rootRect.top) -
        getHeaderOffset(root) -
        CLICK_SCROLL_TOP_GAP;

      root.scrollTo({
        top: Math.max(0, targetTop),
        behavior: getScrollBehavior(),
      });

      scheduleCurrentMessageSync();
    },
    [getHeaderOffset, getMessageElement, getScrollBehavior, scheduleCurrentMessageSync, scrollRootRef]
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
        : highlightState.activeIndex;

      if (pressedKey === "Enter" || pressedKey === " ") {
        if (event.target === event.currentTarget) {
          event.preventDefault();
          const activeItem = navigationItems[highlightState.activeIndex];
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
    [focusItem, highlightState.activeIndex, navigationItems, scrollToMessage]
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

      if (index === highlightState.activeIndex) {
        return;
      }

      hoverPreviewTimerRef.current = setTimeout(() => {
        setPreviewItemId(item.id);
      }, HOVER_PREVIEW_DELAY);
    },
    [clearHoverPreviewTimer, highlightState.activeIndex]
  );

  if (isMobile || navigationItems.length < MIN_MESSAGES || !viewport.ready) {
    return null;
  }

  const previewItem =
    previewItemId === null
      ? null
      : navigationItems.find((item) => item.id === previewItemId) ?? null;

  const panelHeight = Math.min(
    navigationItems.length * 30,
    viewport.maxHeight,
    NAVIGATOR_MAX_HEIGHT
  );

  const getRailStrength = (index: number): number => {
    if (highlightState.fromIndex === highlightState.toIndex) {
      return index === highlightState.fromIndex ? 1 : 0;
    }

    if (index === highlightState.fromIndex) {
      return 1 - highlightState.progress;
    }

    if (index === highlightState.toIndex) {
      return highlightState.progress;
    }

    return 0;
  };

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
          ref={scrollContainerRef}
          className={cn(
            "message-navigator-scroll relative overflow-y-auto outline-none",
            !isExpanded && "message-navigator-scroll-collapsed"
          )}
          style={{ maxHeight: `${panelHeight}px` }}
          tabIndex={0}
          onKeyDown={handleKeyDown}
        >
          <div className="flex flex-col">
            {navigationItems.map((item, index) => {
              const isCurrent = index === highlightState.activeIndex;
              const isHovered = hoveredIndex === index;
              const showHoveredState = isHovered && !isCurrent;
              const railStrength = getRailStrength(index);
              const railWidth =
                RAIL_BASE_WIDTH +
                (RAIL_ACTIVE_WIDTH - RAIL_BASE_WIDTH) * railStrength;
              const railHeight =
                RAIL_BASE_HEIGHT +
                (RAIL_ACTIVE_HEIGHT - RAIL_BASE_HEIGHT) * railStrength;
              const railColor =
                railStrength > 0
                  ? `rgba(57, 100, 254, ${0.22 + railStrength * 0.78})`
                  : showHoveredState
                    ? "#111111"
                    : "rgba(0, 0, 0, 0.2)";

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
                    "group relative flex h-[30px] w-full items-center rounded-[14px] text-left outline-none transition-colors duration-150",
                    isCurrent
                      ? "bg-transparent"
                      : showHoveredState
                        ? "bg-transparent"
                        : "bg-transparent",
                    "focus-visible:ring-2 focus-visible:ring-[#3964FE]/20"
                  )}
                >
                  <div className="min-w-0 flex-1 overflow-hidden pr-11">
                    <div
                      className={cn(
                        "min-w-0 overflow-hidden whitespace-nowrap text-[13px] leading-5 transition-[opacity,color,transform,max-width,padding] duration-180",
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
                      <div className="block truncate">{item.label}</div>
                    </div>
                  </div>

                  <div className="pointer-events-none absolute inset-y-0 right-0 flex w-[44px] items-center justify-end pr-[2px]">
                    <span
                      className="rounded-full"
                      style={{
                        width: `${railWidth}px`,
                        height: `${railHeight}px`,
                        backgroundColor: railColor,
                      }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {isExpanded && previewItem && hoveredIndex !== highlightState.activeIndex ? (
        <div
          className="absolute z-10"
          style={{
            top: `${previewTop}px`,
            right: "100%",
            transform: "translateY(-50%)",
            width: `calc(min(${PREVIEW_MAX_WIDTH}px, 42vw) + ${PREVIEW_GAP}px)`,
          }}
        >
          <div
            className="rounded-[18px] bg-[#1F1F1F] px-3 py-2 text-white shadow-[0_14px_30px_rgba(0,0,0,0.22)]"
            style={{ width: `min(${PREVIEW_MAX_WIDTH}px, 42vw)` }}
          >
            <p className="message-navigator-preview-scroll max-h-[50vh] overflow-y-auto whitespace-pre-wrap break-words text-[13px] leading-6">
              {previewItem.preview}
            </p>
          </div>
        </div>
      ) : null}
    </aside>
  );
}
