"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";

import { updateMyOnboardingStatus } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useGrowth } from "@/lib/growth-context";
import { useUserSettings } from "@/lib/user-settings-context";
import { useIsMobile } from "@/hooks/useIsMobile";
import { queryKeys } from "@/lib/query";
import {
  getAdjacentStepId,
  isTerminalLocalStatus,
  isTerminalServerStatus,
  resolveTourEntry,
  selectAvailableSteps,
  type OnboardingLocalState,
  type TourLocalStatus,
  type TourPhase,
  type TourRoute,
} from "@/lib/onboarding/tour-state";
import {
  markBrowserTourCompleted,
  onboardingStorageKey,
  readBrowserTourCompleted,
  readOnboardingLocal,
  writeOnboardingLocal,
} from "@/lib/onboarding/tour-storage";
import { peekResumeCharacterId } from "@/lib/pending-chat";
import TourCard from "./TourCard";
import TourSpotlight, { type SpotlightHole } from "./TourSpotlight";
import { computeCardPosition } from "./positioning";
import {
  BETTER_EXPRESSION_HINT,
  CHAT_FIRST_STEP_ID,
  CHAT_STEPS,
  DISCOVER_FIRST_STEP_ID,
  DISCOVER_STEPS,
} from "./tour-steps";
import type { TourRuntime, TourStep } from "./types";
import { isVisibleTargetRect, useTourTarget } from "./useTourTarget";

function getTourRoute(pathname: string): TourRoute {
  if (pathname === "/") {
    return "discover";
  }

  // /chat/new 是乐观导航的过渡页，不是真实对话，不触发聊天导览。
  if (pathname === "/chat/new" || pathname === "/chat/new/") {
    return null;
  }

  if (/^\/chat\/[^/]+\/?$/.test(pathname)) {
    return "chat";
  }

  return null;
}

// 访客没有账号，用一个稳定的本地身份承载导览进度（只写 localStorage，不写后端）。
const GUEST_TOUR_ID = "guest";

function buildLocalState(
  status: TourLocalStatus,
  phase: TourPhase,
  stepId: string,
  feedbackHintPending: boolean,
): OnboardingLocalState {
  return {
    version: 1,
    status,
    phase,
    stepId,
    feedbackHintPending,
    updatedAt: Date.now(),
  };
}

function useAvailableSteps(
  phase: "discover" | "chat" | null,
  replyCardEnabled: boolean,
  retryKey: string,
): string[] | null {
  const [availableIds, setAvailableIds] = useState<string[] | null>(null);

  useEffect(() => {
    setAvailableIds(null);
    if (!phase) {
      return;
    }

    const steps = phase === "discover" ? DISCOVER_STEPS : CHAT_STEPS;
    const readySelector =
      phase === "chat" && replyCardEnabled
        ? '[data-tour="chat-sentence-card"]'
        : null;

    let disposed = false;
    let mutationObserver: MutationObserver | null = null;
    let readyTimeout: ReturnType<typeof setTimeout> | null = null;
    let settleTimer: ReturnType<typeof setTimeout> | null = null;

    const compute = () => {
      if (disposed) {
        return;
      }

      const ids = selectAvailableSteps(steps, (step) => {
        if (step.requiresReplyCard && !replyCardEnabled) {
          return false;
        }
        return document.querySelector(step.target) !== null;
      }).map((step) => step.id);

      setAvailableIds(ids);
    };

    const isReady = () => {
      if (readySelector) {
        return document.querySelector(readySelector) !== null;
      }

      return steps.some((step) => document.querySelector(step.target) !== null);
    };

    const scheduleCompute = () => {
      if (settleTimer) {
        clearTimeout(settleTimer);
      }
      settleTimer = setTimeout(compute, 250);
    };

    const clearReadyTimeout = () => {
      if (readyTimeout) {
        clearTimeout(readyTimeout);
        readyTimeout = null;
      }
    };

    if (isReady()) {
      scheduleCompute();
    } else {
      mutationObserver = new MutationObserver(() => {
        if (disposed || !isReady()) {
          return;
        }

        mutationObserver?.disconnect();
        mutationObserver = null;
        clearReadyTimeout();
        scheduleCompute();
      });
      mutationObserver.observe(document.body, {
        childList: true,
        subtree: true,
      });
      readyTimeout = setTimeout(() => {
        mutationObserver?.disconnect();
        mutationObserver = null;
        compute();
      }, 10000);
    }

    return () => {
      disposed = true;
      mutationObserver?.disconnect();
      clearReadyTimeout();
      if (settleTimer) {
        clearTimeout(settleTimer);
      }
    };
  }, [phase, replyCardEnabled, retryKey]);

  return availableIds;
}

export default function OnboardingTour() {
  const { user, isInitialLoading: isAuthLoading } = useAuth();
  const { isEntryPopupVisible } = useGrowth();
  const { replyCardEnabled } = useUserSettings();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

  const [mounted, setMounted] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [viewport, setViewport] = useState(() => ({
    width: typeof window === "undefined" ? 0 : window.innerWidth,
    height: typeof window === "undefined" ? 0 : window.innerHeight,
  }));
  const [runtime, setRuntime] = useState<TourRuntime>({ state: "hidden" });
  // 浏览器级「已走过导览」标记。访客走完导览后，之后登录的任何账号都直接完成导览。
  // 惰性初始化：避免 mount effect 才赋值时，同一批 effect 先闪出一帧导览。
  const [browserCompleted, setBrowserCompleted] = useState(
    () => readBrowserTourCompleted() || peekResumeCharacterId() !== null,
  );
  const syncedUserIdRef = useRef<string | null>(null);
  const pausedForPopupRef = useRef<TourRuntime | null>(null);
  const wasPopupVisibleRef = useRef(false);
  const pausedForRouteRef = useRef<TourRoute>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const cardBoxRef = useRef<HTMLDivElement | null>(null);

  // 认证解析完成后仍无用户 = 访客。访客用一个稳定的本地身份走发现页导览，
  // serverStatus 视为 pending，导览进度只写 localStorage，不写需要登录的后端。
  const isGuest = !isAuthLoading && !user;
  const userId = user?.id ?? (isGuest ? GUEST_TOUR_ID : null);
  const serverStatus =
    user?.onboarding_status ?? (isGuest ? ("pending" as const) : undefined);
  const route = getTourRoute(pathname);
  const phase = runtime.state === "tour" ? runtime.phase : null;

  const availableIds = useAvailableSteps(phase, replyCardEnabled, pathname);
  const steps = useMemo<TourStep[]>(
    () =>
      phase === "discover"
        ? DISCOVER_STEPS
        : phase === "chat"
          ? CHAT_STEPS
          : [],
    [phase],
  );

  const currentStep = useMemo<TourStep | null>(() => {
    if (runtime.state === "hint") {
      return BETTER_EXPRESSION_HINT;
    }

    if (runtime.state !== "tour" || !availableIds || availableIds.length === 0) {
      return null;
    }

    const stepId = availableIds.includes(runtime.stepId)
      ? runtime.stepId
      : availableIds[0];

    return steps.find((step) => step.id === stepId) ?? null;
  }, [availableIds, runtime, steps]);

  const currentIndex =
    currentStep && availableIds ? availableIds.indexOf(currentStep.id) : -1;

  const persistLocal = useCallback(
    (state: OnboardingLocalState) => {
      if (!userId) {
        return;
      }
      writeOnboardingLocal(userId, state);
    },
    [userId],
  );

  const persistStatus = useCallback(
    async (status: "discover_done" | "completed" | "skipped") => {
      // 访客没有登录态，只保留本地导览进度，不调用需要鉴权的后端接口。
      if (!userId || isGuest) {
        return;
      }

      try {
        const updated = await updateMyOnboardingStatus(status);
        queryClient.setQueryData(queryKeys.user.profile(userId), updated);
      } catch (error) {
        console.error("Failed to persist onboarding status:", error);
      }
    },
    [queryClient, userId, isGuest],
  );

  // 访客走完 / 跳过导览后，标记这个浏览器已经走过。点角色触发的登录也属于
  // 这一路径：访客已经在发现页浏览并选中了角色，登录后不该再被导览拦一次。
  const markGuestTourCompleted = useCallback(() => {
    if (!isGuest) {
      return;
    }
    markBrowserTourCompleted();
    setBrowserCompleted(true);
  }, [isGuest]);

  const handleNext = useCallback(() => {
    if (runtime.state !== "tour" || !phase || !currentStep) {
      return;
    }

    const stepIds = availableIds;
    if (!stepIds) {
      return;
    }

    const nextId = getAdjacentStepId(stepIds, currentStep.id, 1);
    if (!nextId) {
      if (phase === "discover") {
        persistLocal(buildLocalState("active", "chat", CHAT_FIRST_STEP_ID, false));
        // 访客只能走发现页导览，走完即视为这个浏览器已经导览过。
        markGuestTourCompleted();
        void persistStatus("discover_done");
      } else {
        persistLocal(buildLocalState("completed", "chat", currentStep.id, true));
        markGuestTourCompleted();
        void persistStatus("completed");
      }

      setRuntime({ state: "hidden" });
      return;
    }

    persistLocal(buildLocalState("active", phase, nextId, false));
    setRuntime({ state: "tour", phase, stepId: nextId });
  }, [
    availableIds,
    currentStep,
    markGuestTourCompleted,
    persistLocal,
    persistStatus,
    phase,
    runtime.state,
  ]);

  const handlePrevious = useCallback(() => {
    if (runtime.state !== "tour" || !phase || !currentStep || !availableIds) {
      return;
    }

    const previousId = getAdjacentStepId(availableIds, currentStep.id, -1);
    if (!previousId) {
      return;
    }

    persistLocal(buildLocalState("active", phase, previousId, false));
    setRuntime({ state: "tour", phase, stepId: previousId });
  }, [availableIds, currentStep, persistLocal, phase, runtime.state]);

  const handleSkip = useCallback(() => {
    const stepId =
      currentStep?.id ??
      (phase === "chat" ? CHAT_FIRST_STEP_ID : DISCOVER_FIRST_STEP_ID);

    if (userId) {
      persistLocal(buildLocalState("skipped", phase ?? "discover", stepId, false));
      void persistStatus("skipped");
    }

    markGuestTourCompleted();
    setRuntime({ state: "hidden" });
  }, [currentStep, markGuestTourCompleted, persistLocal, persistStatus, phase, userId]);

  const handlePause = useCallback(() => {
    pausedForRouteRef.current = route;
    setRuntime({ state: "hidden" });
  }, [route]);

  const handleDismissHint = useCallback(() => {
    if (userId) {
      const local = readOnboardingLocal(userId);
      if (local) {
        writeOnboardingLocal(userId, {
          ...local,
          feedbackHintPending: false,
          updatedAt: Date.now(),
        });
      }
    }

    setRuntime({ state: "hidden" });
  }, [userId]);

  useEffect(() => {
    setMounted(true);
    // 点角色触发的登录路径同样视为已经导览过：访客在发现页选中了角色，
    // 登录后应直接进聊天，而不是被导览拦住。只单调置 true，避免覆盖本次
    // 会话里刚完成的访客导览。
    setBrowserCompleted((previous) =>
      previous || readBrowserTourCompleted() || peekResumeCharacterId() !== null,
    );

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(mediaQuery.matches);
    const updateViewport = () =>
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    update();
    updateViewport();
    mediaQuery.addEventListener("change", update);
    window.addEventListener("resize", updateViewport);

    return () => {
      mediaQuery.removeEventListener("change", update);
      window.removeEventListener("resize", updateViewport);
    };
  }, []);

  // 这个浏览器已经走过导览后，登录后无论用哪个账号，都把该账号的导览
  // 直接标记为完成：本地写终态防止重放，服务端同步一次让其它设备也不再重放。
  useEffect(() => {
    // 等 serverStatus 就绪再同步：登录瞬间 profile 查询还在飞，
    // 过早 PATCH 会被随后返回的旧 profile 覆盖。
    if (
      !browserCompleted ||
      isGuest ||
      !userId ||
      !serverStatus ||
      syncedUserIdRef.current === userId
    ) {
      return;
    }
    syncedUserIdRef.current = userId;

    const local = readOnboardingLocal(userId);
    if (!local || !isTerminalLocalStatus(local.status)) {
      writeOnboardingLocal(userId, buildLocalState("completed", "chat", CHAT_FIRST_STEP_ID, false));
    }

    if (!isTerminalServerStatus(serverStatus)) {
      void persistStatus("completed");
    }
  }, [browserCompleted, isGuest, userId, serverStatus, persistStatus]);

  // browserCompleted 在 mount 后才从 localStorage 读出，可能晚于主 effect 一帧；
  // 这里显式收起，避免「已导览过」的浏览器仍闪出一帧导览。
  useEffect(() => {
    if (!browserCompleted) {
      return;
    }
    pausedForPopupRef.current = null;
    setRuntime((previous) =>
      previous.state === "hidden" ? previous : { state: "hidden" },
    );
  }, [browserCompleted]);

  useEffect(() => {
    if (!userId || !serverStatus || !route) {
      return;
    }

    if (isEntryPopupVisible) {
      return;
    }

    if (pausedForRouteRef.current === route) {
      return;
    }

    const local = readOnboardingLocal(userId);
    const entry = resolveTourEntry({
      serverStatus,
      route,
      local,
      discoverFirstStepId: DISCOVER_FIRST_STEP_ID,
      chatFirstStepId: CHAT_FIRST_STEP_ID,
      browserCompleted,
    });

    if (!entry) {
      return;
    }

    if (entry.phase === "chat" && local?.phase === "discover") {
      persistLocal(buildLocalState("active", "chat", CHAT_FIRST_STEP_ID, false));
      if (serverStatus === "pending") {
        void persistStatus("discover_done");
      }
    }

    setRuntime((previous) => {
      if (previous.state === "hint") {
        return previous;
      }

      if (previous.state === "tour" && previous.phase === entry.phase) {
        return previous;
      }

      if (!previousFocusRef.current && document.activeElement instanceof HTMLElement) {
        previousFocusRef.current = document.activeElement;
      }

      return { state: "tour", phase: entry.phase, stepId: entry.stepId };
    });
  }, [
    browserCompleted,
    isEntryPopupVisible,
    persistLocal,
    persistStatus,
    route,
    serverStatus,
    userId,
  ]);

  // 签到弹窗期间暂停导览，关闭后从原步骤恢复；不要重新 resolve 从头再来，
  // 否则用户会遇到「导览→签到→导览」来回横跳。
  useEffect(() => {
    const wasVisible = wasPopupVisibleRef.current;
    wasPopupVisibleRef.current = isEntryPopupVisible;

    if (isEntryPopupVisible && !wasVisible) {
      if (runtime.state !== "hidden") {
        pausedForPopupRef.current = runtime;
        setRuntime({ state: "hidden" });
      }
      return;
    }

    if (!isEntryPopupVisible && wasVisible && pausedForPopupRef.current) {
      const paused = pausedForPopupRef.current;
      pausedForPopupRef.current = null;
      // 弹窗期间可能已经切到非导览路由，此时不要再恢复导览。
      if (route) {
        setRuntime(paused);
      }
    }
  }, [isEntryPopupVisible, route, runtime]);

  useEffect(() => {
    if (route) {
      return;
    }

    setRuntime((previous) =>
      previous.state === "hidden" ? previous : { state: "hidden" },
    );
  }, [route]);

  useEffect(() => {
    if (pausedForRouteRef.current && pausedForRouteRef.current !== route) {
      pausedForRouteRef.current = null;
    }
  }, [route]);

  useEffect(() => {
    setRuntime((previous) =>
      previous.state === "hint" ? { state: "hidden" } : previous,
    );
  }, [pathname]);

  useEffect(() => {
    if (!userId || typeof window === "undefined") {
      return;
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== onboardingStorageKey(userId)) {
        return;
      }

      const next = readOnboardingLocal(userId);
      if (!next || next.status === "completed" || next.status === "skipped") {
        setRuntime({ state: "hidden" });
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [userId]);

  useEffect(() => {
    if (!userId || route !== "chat" || runtime.state !== "hidden") {
      return;
    }

    const local = readOnboardingLocal(userId);
    if (!local?.feedbackHintPending) {
      return;
    }

    let disposed = false;
    let mutationObserver: MutationObserver | null = null;
    let timeout: ReturnType<typeof setTimeout> | null = null;

    const showHint = () => {
      if (disposed) {
        return true;
      }

      const hasVisibleBubble = Array.from(
        document.querySelectorAll(BETTER_EXPRESSION_HINT.target),
      ).some((node) => isVisibleTargetRect(node.getBoundingClientRect()));
      if (!hasVisibleBubble) {
        return false;
      }

      if (!previousFocusRef.current && document.activeElement instanceof HTMLElement) {
        previousFocusRef.current = document.activeElement;
      }

      setRuntime({ state: "hint" });
      return true;
    };

    if (!showHint()) {
      mutationObserver = new MutationObserver(() => {
        if (!showHint()) {
          return;
        }

        mutationObserver?.disconnect();
        mutationObserver = null;
        if (timeout) {
          clearTimeout(timeout);
          timeout = null;
        }
      });
      mutationObserver.observe(document.body, {
        childList: true,
        subtree: true,
      });
      timeout = setTimeout(() => {
        mutationObserver?.disconnect();
        mutationObserver = null;
      }, 30000);
    }

    return () => {
      disposed = true;
      mutationObserver?.disconnect();
      if (timeout) {
        clearTimeout(timeout);
      }
    };
  }, [pathname, route, runtime.state, userId]);

  const isVisible = runtime.state !== "hidden" && currentStep !== null;

  useEffect(() => {
    if (!isVisible || previousFocusRef.current) {
      return;
    }

    previousFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
  }, [isVisible]);

  useEffect(() => {
    if (runtime.state !== "hidden") {
      return;
    }

    const previous = previousFocusRef.current;
    previousFocusRef.current = null;
    if (previous && document.contains(previous)) {
      previous.focus({ preventScroll: true });
    }
  }, [runtime.state]);

  const target = useTourTarget(currentStep?.target ?? null, {
    active: currentStep !== null,
    scrollToTarget: currentStep?.scrollToTarget ?? true,
    targetKey: pathname,
    targetMatch: currentStep?.targetMatch ?? "first",
  });

  const hole = useMemo<SpotlightHole | null>(() => {
    const rect = target.rect;
    if (!isVisibleTargetRect(rect) || typeof window === "undefined") {
      return null;
    }

    const padding = currentStep?.spotlightPadding ?? 8;
    const left = Math.max(0, rect.left - padding);
    const top = Math.max(0, rect.top - padding);
    const right = Math.min(viewport.width, rect.right + padding);
    const bottom = Math.min(viewport.height, rect.bottom + padding);

    if (right <= left || bottom <= top) {
      return null;
    }

    return {
      x: left,
      y: top,
      width: right - left,
      height: bottom - top,
      radius: currentStep?.spotlightRadius ?? 12,
    };
  }, [currentStep, target.rect, viewport]);

  const cardWidth = useMemo(() => {
    if (viewport.width <= 0) {
      return 340;
    }
    return isMobile ? Math.min(340, viewport.width - 32) : 340;
  }, [isMobile, viewport.width]);

  const portalVisible = mounted && currentStep !== null && hole !== null;
  const [cardSize, setCardSize] = useState<{ width: number; height: number } | null>(null);

  useLayoutEffect(() => {
    const element = cardBoxRef.current;
    if (!element) {
      return;
    }

    const update = () => {
      const next = {
        width: element.offsetWidth,
        height: element.offsetHeight,
      };
      setCardSize((previous) =>
        previous &&
        previous.width === next.width &&
        previous.height === next.height
          ? previous
          : next,
      );
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [portalVisible, cardWidth, currentStep?.id, isMobile]);

  const cardPosition = useMemo(() => {
    if (!hole || !cardSize) {
      return null;
    }

    return computeCardPosition(
      hole,
      cardSize,
      viewport,
      currentStep?.placement,
    );
  }, [cardSize, currentStep?.placement, hole, viewport]);

  const cardReady = cardPosition !== null;

  const cardStyle: CSSProperties = {
    position: "fixed",
    left: cardPosition?.x ?? 0,
    top: cardPosition?.y ?? 0,
    width: cardWidth,
    zIndex: 92,
    opacity: cardReady ? 1 : 0,
    pointerEvents: cardReady ? "auto" : "none",
    transition: reducedMotion ? undefined : "opacity 120ms ease-out",
  };

  if (!mounted || !currentStep || !hole) {
    return null;
  }

  const isHint = runtime.state === "hint";
  const description =
    isMobile && currentStep.mobileDescription
      ? currentStep.mobileDescription
      : currentStep.description;
  const primaryLabel = isHint
    ? "知道了"
    : currentStep.primaryLabel ?? "下一步";

  return createPortal(
    <>
      <TourSpotlight hole={hole} allowInteraction={isHint} />

      <div style={cardStyle}>
        {!isMobile && cardPosition ? (
          <div
            className="pointer-events-none absolute z-0 h-2.5 w-2.5 rotate-45 border border-white/70 bg-white/95"
            style={{
              left: cardPosition.arrowLeft,
              [cardPosition.side === "top" ? "bottom" : "top"]: "-5px",
            }}
            aria-hidden="true"
          />
        ) : null}

        <div ref={cardBoxRef} style={{ width: cardWidth }}>
          <TourCard
            title={currentStep.title}
            description={description}
            phaseLabel={phase === "discover" ? "发现导览" : "聊天导览"}
            current={isHint ? 1 : currentIndex + 1}
            total={isHint ? 1 : availableIds?.length ?? 1}
            isHint={isHint}
            isFirst={isHint || currentIndex <= 0}
            primaryLabel={primaryLabel}
            onNext={isHint ? handleDismissHint : handleNext}
            onPrevious={handlePrevious}
            onSkip={handleSkip}
            onDismissHint={handleDismissHint}
            onPause={isHint ? handleDismissHint : handlePause}
            cardRef={cardRef}
            reducedMotion={reducedMotion}
          />
        </div>
      </div>
    </>,
    document.body,
  );
}
