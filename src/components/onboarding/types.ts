import type { Placement } from "@floating-ui/react";

import type { TourPhase } from "@/lib/onboarding/tour-state";

export interface TourStep {
  id: string;
  phase: TourPhase;
  target: string;
  title: string;
  description: string;
  mobileDescription?: string;
  placement: Placement;
  spotlightPadding?: number;
  spotlightRadius?: number;
  scrollToTarget?: boolean;
  primaryLabel?: string;
  requiresReplyCard?: boolean;
  targetMatch?: "first" | "last";
}

export type TourRuntime =
  | { state: "hidden" }
  | { state: "tour"; phase: TourPhase; stepId: string }
  | { state: "hint" };
