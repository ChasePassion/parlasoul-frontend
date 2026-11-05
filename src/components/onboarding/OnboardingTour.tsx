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
  resolveTourEntry,
  selectAvailableSteps,
  type OnboardingLocalState,
  type TourRoute,
} from "@/lib/onboarding/tour-state";
import {
  onboardingStorageKey,
  readOnboardingLocal,
  writeOnboardingLocal,
} from "@/lib/onboarding/tour-storage";
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

  if (/^\/chat\/[^/]+\/?$/.test(pathname)) {
    return "chat";
  }

  return null;
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
  const { user } = useAuth();
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
  const pausedForRouteRef = useRef<TourRoute>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const cardBoxRef = useRef<HTMLDivElement | null>(null);

  const userId = user?.id ?? null;
  const serverStatus = user?.onboarding_status;
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
      if (!userId) {
        return;
      }

      try {
        const updated = await updateMyOnboardingStatus(status);
        queryClient.setQueryData(queryKeys.user.profile(userId), updated);
      } catch (error) {
        console.error("Failed to persist onboarding status:", error);
      }
    },
    [queryClient, userId],
  );

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
        persistLocal({
          version: 1,
          status: "active",
          phase: "chat",
          stepId: CHAT_FIRST_STEP_ID,
          feedbackHintPending: false,
          updatedAt: Date.now(),
        });
        void persistStatus("discover_done");
      } else {
        persistLocal({
          version: 1,
          status: "completed",
          phase: "chat",
          stepId: currentStep.id,
          feedbackHintPending: true,
          updatedAt: Date.now(),
        });
        void persistStatus("completed");
      }

      setRuntime({ state: "hidden" });
      return;
    }

    persistLocal({
      version: 1,
      status: "active",
      phase,
      stepId: nextId,
      feedbackHintPending: false,
      updatedAt: Date.now(),
    });
    setRuntime({ state: "tour", phase, stepId: nextId });
  }, [
    availableIds,
    currentStep,
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

    persistLocal({
      version: 1,
      status: "active",
      phase,
      stepId: previousId,
      feedbackHintPending: false,
      updatedAt: Date.now(),
    });
    setRuntime({ state: "tour", phase, stepId: previousId });
  }, [availableIds, currentStep, persistLocal, phase, runtime.state]);

  const handleSkip = useCallback(() => {
    const stepId =
      currentStep?.id ??
      (phase === "chat" ? CHAT_FIRST_STEP_ID : DISCOVER_FIRST_STEP_ID);

    if (userId) {
      persistLocal({
        version: 1,
        status: "skipped",
        phase: phase ?? "discover",
        stepId,
        feedbackHintPending: false,
        updatedAt: Date.now(),
      });
      void persistStatus("skipped");
    }

    setRuntime({ state: "hidden" });
  }, [currentStep, persistLocal, persistStatus, phase, userId]);

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
    });

    if (!entry) {
      return;
    }

    if (entry.phase === "chat" && local?.phase === "discover") {
      persistLocal({
        version: 1,
        status: "active",
        phase: "chat",
        stepId: CHAT_FIRST_STEP_ID,
        feedbackHintPending: false,
        updatedAt: Date.now(),
      });
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
    isEntryPopupVisible,
    persistLocal,
    persistStatus,
    route,
    serverStatus,
    userId,
  ]);

  useEffect(() => {
    if (!isEntryPopupVisible) {
      return;
    }

    setRuntime((previous) =>
      previous.state === "hidden" ? previous : { state: "hidden" },
    );
  }, [isEntryPopupVisible]);

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
