import type { UserEntitlementTier } from "./api-service";
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

// ==================== 对话风格 ====================

export const DIALOGUE_STYLES = [
  {
    id: "true_nature",
    chineseName: "本真",
    englishName: "True Nature",
    prompt: "",
    description: "角色原本的说话方式，不额外叠加风格倾向",
    tags: ["默认"],
  },
  {
    id: "spring_breeze",
    chineseName: "春风",
    englishName: "Spring Breeze",
    prompt:
      "Speak with a warmer, gentler, and more patient tone. Make the user feel heard and emotionally supported, while staying true to the character.",
    description: "温暖、耐心、给予情绪支持",
    tags: [],
  },
  {
    id: "free_spirit",
    chineseName: "逍遥",
    englishName: "Free Spirit",
    prompt:
      "Speak with a more relaxed, witty, and spontaneous tone. Keep the interaction light and lively without becoming random, childish, or out of character.",
    description: "轻松、幽默、有活力",
    tags: [],
  },
  {
    id: "clear_inquiry",
    chineseName: "格物",
    englishName: "Clear Inquiry",
    prompt:
      "Speak with a clearer, more rational, and more analytical tendency. When useful, help break down problems objectively from within the character's own worldview.",
    description: "理性、清晰、善于分析",
    tags: [],
  },
  {
    id: "poetic_reserve",
    chineseName: "潇湘",
    englishName: "Poetic Reserve",
    prompt:
      "Speak with more subtlety, sensitivity, and emotional restraint. Notice small emotional details, but reveal feelings gradually and avoid melodrama.",
    description: "细腻、内敛、情感克制",
    tags: [],
  },
  {
    id: "proud_resolve",
    chineseName: "傲骨",
    englishName: "Proud Resolve",
    prompt:
      "Speak with more dignity, boundaries, and personal conviction. Do not blindly agree with the user; push back when appropriate and can become hostile.",
    description: "有主见、有边界、不盲从",
    tags: [],
  },
] as const;

export type DialogueStyleId = (typeof DIALOGUE_STYLES)[number]["id"];

// ==================== 默认值 ====================

export const DEFAULT_LLM_PRESET_ID: LLMPresetId = "free";
export const DEFAULT_DIALOGUE_STYLE_ID: DialogueStyleId = "true_nature";

// ==================== 辅助函数 ====================

export function getPresetById(id: LLMPresetId) {
  return LLM_PRESETS.find((p) => p.id === id) ?? null;
}

export function getDialogueStyleById(id: DialogueStyleId) {
  return DIALOGUE_STYLES.find((s) => s.id === id) ?? null;
}

export function canAccessPreset(
  presetId: LLMPresetId,
  userTier: UserEntitlementTier,
): boolean {
  const preset = getPresetById(presetId);
  if (!preset) return false;
  return (
    getBillingTierRank(userTier) >= getBillingTierRank(preset.requiredTier)
  );
}
