"use client";

import { useEffect, useState } from "react";

interface TourTargetState {
  element: Element | null;
  rect: DOMRect | null;
}

interface UseTourTargetOptions {
  active: boolean;
  scrollToTarget?: boolean;
  targetKey?: string;
  targetMatch?: "first" | "last";
}

const SCROLL_SAFE_MARGIN = 120;
const MIN_TARGET_SIZE = 2;

export function isVisibleTargetRect(rect: DOMRect | null): rect is DOMRect {
  if (!rect || rect.width < MIN_TARGET_SIZE || rect.height < MIN_TARGET_SIZE) {
    return false;
  }

  if (typeof window === "undefined") {
    return false;
  }

  return (
    rect.bottom > 0 &&
    rect.right > 0 &&
    rect.top < window.innerHeight &&
    rect.left < window.innerWidth
  );
}

export function useTourTarget(
  selector: string | null,
  {
    active,
    scrollToTarget = true,
    targetKey = "",
    targetMatch = "first",
  }: UseTourTargetOptions,
): TourTargetState {
  const [state, setState] = useState<TourTargetState>({
    element: null,
    rect: null,
  });

  useEffect(() => {
    if (!active || !selector) {
      setState({ element: null, rect: null });
      return;
    }

    let disposed = false;
    let element: Element | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let mutationObserver: MutationObserver | null = null;
    let raf = 0;

    // 只排除占位 / 隐藏节点，不要求在视口内：发现页的分区常在首屏之外，
    // 需要靠 scrollIntoView 带进来。
    const isRenderedTarget = (candidate: Element): boolean => {
      const rect = candidate.getBoundingClientRect();
      if (rect.width < MIN_TARGET_SIZE || rect.height < MIN_TARGET_SIZE) {
        return false;
      }

      const style = window.getComputedStyle(candidate);
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        style.opacity !== "0" &&
        candidate.getClientRects().length > 0
      );
    };

    const pickTarget = (): Element | null => {
      const matches = Array.from(document.querySelectorAll(selector));
      if (targetMatch === "last") {
        matches.reverse();
      }

      return matches.find(isRenderedTarget) ?? null;
    };

    // 每次刷新都重新解析选择器：消息列表是异步渲染的，首帧可能只有占位节点，
    // 锁定它会导致后续所有坐标都基于一个错误矩形。
    const publish = (nextElement: Element | null, rect: DOMRect | null) => {
      setState((previous) => {
        if (
          previous.element === nextElement &&
          previous.rect === null &&
          rect === null
        ) {
          return previous;
        }

        if (
          previous.element === nextElement &&
          previous.rect &&
          rect &&
          Math.abs(previous.rect.x - rect.x) < 0.5 &&
          Math.abs(previous.rect.y - rect.y) < 0.5 &&
          Math.abs(previous.rect.width - rect.width) < 0.5 &&
          Math.abs(previous.rect.height - rect.height) < 0.5
        ) {
          return previous;
        }

        return { element: nextElement, rect };
      });
    };

    const detach = () => {
      resizeObserver?.disconnect();
      resizeObserver = null;
      element = null;
    };

    const attach = (target: Element, allowScroll: boolean) => {
      detach();
      element = target;
      resizeObserver = new ResizeObserver(scheduleRefresh);
      resizeObserver.observe(target);

      if (allowScroll && scrollToTarget) {
        const rect = target.getBoundingClientRect();
        const needsScroll =
          rect.top < SCROLL_SAFE_MARGIN ||
          rect.bottom > window.innerHeight - SCROLL_SAFE_MARGIN;

        if (needsScroll) {
          const reducedMotion = window.matchMedia(
            "(prefers-reduced-motion: reduce)",
          ).matches;
          target.scrollIntoView({
            behavior: reducedMotion ? "auto" : "smooth",
            block: "center",
            inline: "nearest",
          });
        }
      }
    };

    const refresh = () => {
      if (disposed) {
        return;
      }

      const target = pickTarget();
      if (!target) {
        if (element !== null) {
          detach();
          publish(null, null);
        }
        return;
      }

      if (target !== element) {
        attach(target, true);
      }

      const rect = target.getBoundingClientRect();
      publish(target, isVisibleTargetRect(rect) ? rect : null);
    };

    function scheduleRefresh() {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(refresh);
    }

    refresh();

    mutationObserver = new MutationObserver(scheduleRefresh);
    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });
    window.addEventListener("scroll", scheduleRefresh, true);
    window.addEventListener("resize", scheduleRefresh);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      detach();
      mutationObserver?.disconnect();
      window.removeEventListener("scroll", scheduleRefresh, true);
      window.removeEventListener("resize", scheduleRefresh);
    };
  }, [active, selector, scrollToTarget, targetKey, targetMatch]);

  return state;
}
