import type { TourStep } from "./types";

export const DISCOVER_STEPS: TourStep[] = [
  {
    id: "discover-companion",
    phase: "discover",
    target: '[data-tour="discover-companion"]',
    title: "陪伴 · 像老朋友一样",
    description: "随时聊日常、聊心情，在轻松的氛围里开口。",
    placement: "bottom-start",
    spotlightPadding: 12,
    spotlightRadius: 14,
  },
  {
    id: "discover-story",
    phase: "discover",
    target: '[data-tour="discover-story"]',
    title: "剧情 · 一起走进故事",
    description: "你和角色一起探索一段剧情，每次回复都是全新的开始。",
    placement: "bottom-start",
    spotlightPadding: 12,
    spotlightRadius: 14,
  },
  {
    id: "discover-professional",
    phase: "discover",
    target: '[data-tour="discover-professional"]',
    title: "职业 · 真实场景实战",
    description: "面试、会议、谈判，提前演练每个关键时刻。点开任意角色开始。",
    placement: "bottom-start",
    spotlightPadding: 12,
    spotlightRadius: 14,
    primaryLabel: "开始聊天",
  },
];

export const CHAT_STEPS: TourStep[] = [
  {
    id: "chat-sentence-card",
    phase: "chat",
    target: '[data-tour="chat-sentence-card"]',
    title: "句子卡片",
    description: "点开看整句翻译和重点表达，边聊边学。",
    placement: "bottom",
    spotlightPadding: 8,
    spotlightRadius: 10,
    requiresReplyCard: true,
  },
  {
    id: "chat-play",
    phase: "chat",
    target: '[data-tour="chat-play"]',
    title: "想让角色自己往下说？",
    description: "点这个播放键，让角色主动推进，配合剧情角色体验更佳。",
    placement: "top-end",
    spotlightPadding: 8,
    spotlightRadius: 18,
    scrollToTarget: false,
    primaryLabel: "开始聊天",
  },
];

export const BETTER_EXPRESSION_HINT: TourStep = {
  id: "chat-better-expression",
  phase: "chat",
  target: '[data-tour="chat-user-bubble"]',
  title: "更优表达",
  description: "把鼠标移到你的消息上，点击“灯泡”，看看更地道的说法。",
  mobileDescription: "点击消息下方的“灯泡”，看看更地道的说法。",
  placement: "top",
  spotlightPadding: 10,
  spotlightRadius: 12,
  targetMatch: "last",
};

export const DISCOVER_FIRST_STEP_ID = DISCOVER_STEPS[0].id;
export const CHAT_FIRST_STEP_ID = CHAT_STEPS[0].id;
