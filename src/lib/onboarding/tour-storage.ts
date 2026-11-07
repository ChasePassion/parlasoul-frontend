import type {
  OnboardingLocalState,
  TourLocalStatus,
  TourPhase,
} from "./tour-state";

const STORAGE_VERSION = 1;
const PHASES = new Set<TourPhase>(["discover", "chat"]);

// 浏览器级标记：不绑定账号。访客走过一遍导览后，这个浏览器之后登录的任何账号
// 都视为已经完成导览，不再重放。
const BROWSER_TOUR_COMPLETED_KEY = "parlasoul:onboarding:browser-completed:v1";

export function onboardingStorageKey(userId: string): string {
  return `parlasoul:onboarding:v1:${userId}`;
}

export function readBrowserTourCompleted(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    return window.localStorage.getItem(BROWSER_TOUR_COMPLETED_KEY) === "1";
  } catch {
    return false;
  }
}

export function markBrowserTourCompleted(): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(BROWSER_TOUR_COMPLETED_KEY, "1");
  } catch {
    // Storage can be unavailable in private browsing; the tour still works for
    // the current page load.
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isLocalStatus(value: unknown): value is TourLocalStatus {
  return value === "active" || value === "completed" || value === "skipped";
}

function isPhase(value: unknown): value is TourPhase {
  return typeof value === "string" && PHASES.has(value as TourPhase);
}

export function readOnboardingLocal(
  userId: string | null | undefined,
): OnboardingLocalState | null {
  if (!userId || typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(onboardingStorageKey(userId));
    if (!raw) {
      return null;
    }

    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) {
      return null;
    }

    if (
      parsed.version !== STORAGE_VERSION ||
      !isLocalStatus(parsed.status) ||
      !isPhase(parsed.phase) ||
      typeof parsed.stepId !== "string" ||
      parsed.stepId.length === 0 ||
      typeof parsed.feedbackHintPending !== "boolean" ||
      typeof parsed.updatedAt !== "number"
    ) {
      return null;
    }

    return {
      version: STORAGE_VERSION,
      status: parsed.status,
      phase: parsed.phase,
      stepId: parsed.stepId,
      feedbackHintPending: parsed.feedbackHintPending,
      updatedAt: parsed.updatedAt,
    };
  } catch {
    return null;
  }
}

export function writeOnboardingLocal(
  userId: string | null | undefined,
  state: OnboardingLocalState,
): void {
  if (!userId || typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      onboardingStorageKey(userId),
      JSON.stringify(state),
    );
  } catch {
    // Storage can be unavailable in private browsing; the tour still works for
    // the current page load.
  }
}

export function clearOnboardingLocal(
  userId: string | null | undefined,
): void {
  if (!userId || typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.removeItem(onboardingStorageKey(userId));
  } catch {
    // Ignore storage failures.
  }
}
