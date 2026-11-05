import type {
  OnboardingLocalState,
  TourLocalStatus,
  TourPhase,
} from "./tour-state";

const STORAGE_VERSION = 1;
const PHASES = new Set<TourPhase>(["discover", "chat"]);

export function onboardingStorageKey(userId: string): string {
  return `parlasoul:onboarding:v1:${userId}`;
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
