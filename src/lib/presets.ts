import type { UserEntitlementTier } from "./api-service";
import { isBillingPaywallDisabled } from "./billing-flags";
import { getBillingTierRank } from "./billing-plans";

// ==================== 模型层级 ====================

export const LLM_PRESETS = [
  {
    id: "free",
    name: "免费",
    description: "自然流畅的角色对话体验",
    requiredTier: "free" as const,
  },
  {
    id: "flagship",
    name: "旗舰",
    description: "最强角色沉浸感与情感表达",
    requiredTier: "plus" as const,
  },
] as const;

export type LLMPresetId = (typeof LLM_PRESETS)[number]["id"];

// ==================== 默认值 ====================

export const DEFAULT_LLM_PRESET_ID: LLMPresetId = "free";

// ==================== 辅助函数 ====================

export function getPresetById(id: LLMPresetId) {
  return LLM_PRESETS.find((p) => p.id === id) ?? null;
}

export function canAccessPreset(
  presetId: LLMPresetId,
  userTier: UserEntitlementTier,
): boolean {
  const preset = getPresetById(presetId);
  if (!preset) return false;
  if (isBillingPaywallDisabled()) return true;
  return (
    getBillingTierRank(userTier) >= getBillingTierRank(preset.requiredTier)
  );
}
