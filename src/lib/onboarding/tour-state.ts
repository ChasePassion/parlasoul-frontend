import type { OnboardingStatus } from "@/lib/api-service";

export type TourPhase = "discover" | "chat";
export type TourLocalStatus = "active" | "completed" | "skipped";
export type TourRoute = "discover" | "chat" | null;

export interface OnboardingLocalState {
  version: 1;
  status: TourLocalStatus;
  phase: TourPhase;
  stepId: string;
  feedbackHintPending: boolean;
  updatedAt: number;
}

export interface TourEntry {
  phase: TourPhase;
  stepId: string;
}

const TERMINAL_SERVER_STATUSES = new Set<OnboardingStatus>(["completed", "skipped"]);
const TERMINAL_LOCAL_STATUSES = new Set<TourLocalStatus>(["completed", "skipped"]);

export function isTerminalServerStatus(
  status: OnboardingStatus | undefined,
): boolean {
  return status ? TERMINAL_SERVER_STATUSES.has(status) : false;
}

export function isTerminalLocalStatus(status: TourLocalStatus): boolean {
  return TERMINAL_LOCAL_STATUSES.has(status);
}

export function resolveTourEntry(args: {
  serverStatus: OnboardingStatus | undefined;
  route: TourRoute;
  local: OnboardingLocalState | null;
  discoverFirstStepId: string;
  chatFirstStepId: string;
  // 浏览器已经走过一遍导览时，无论当前账号的服务端状态是什么都不再重放。
  browserCompleted?: boolean;
}): TourEntry | null {
  const {
    serverStatus,
    route,
    local,
    discoverFirstStepId,
    chatFirstStepId,
    browserCompleted,
  } = args;

  if (
    browserCompleted ||
    !serverStatus ||
    isTerminalServerStatus(serverStatus) ||
    !route
  ) {
    return null;
  }

  if (local && isTerminalLocalStatus(local.status)) {
    return null;
  }

  if (route === "discover") {
    if (
      serverStatus === "pending" &&
      local?.status === "active" &&
      local.phase === "discover"
    ) {
      return { phase: "discover", stepId: local.stepId };
    }

    if (local?.phase === "chat" || serverStatus === "discover_done") {
      return null;
    }

    return { phase: "discover", stepId: discoverFirstStepId };
  }

  if (local?.status === "active" && local.phase === "chat") {
    return { phase: "chat", stepId: local.stepId };
  }

  return { phase: "chat", stepId: chatFirstStepId };
}

export function selectAvailableSteps<T extends { id: string }>(
  steps: readonly T[],
  isAvailable: (step: T) => boolean,
): T[] {
  return steps.filter((step) => isAvailable(step));
}

export function getAdjacentStepId(
  stepIds: readonly string[],
  currentStepId: string,
  direction: -1 | 1,
): string | null {
  const index = stepIds.indexOf(currentStepId);
  if (index < 0) {
    return stepIds[0] ?? null;
  }

  return stepIds[index + direction] ?? null;
}
