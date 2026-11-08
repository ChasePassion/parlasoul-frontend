import type { Message } from "@/components/ChatMessage";
import type {
  FeedbackCard,
  ForgeCharacterPayload,
  ForgeVoicePreviewPayload,
  ReplyCard,
} from "@/lib/api";
import type { ForgeMessagePart } from "@/hooks/useCharacterForge";

/**
 * 登录页演示用到的全部数据。
 *
 * 这些只是「角色说了什么」的内容，不是 UI：所有渲染都由项目里真实的组件完成。
 * 内容围绕一个统一的场景：把一句英文说得更自然。
 */

export const DEMO_CHARACTER = {
  id: "demo-favorite",
  name: "Your Favorite",
  description: "陪你练习地道英语表达",
  avatar: "/avatars/demo/character.webp",
};

export const USER_AVATAR = "/avatars/demo/user.webp";

/** 用户发进对话的照片（真实文件，点开走的是项目里的图片灯箱） */
export const CHAT_IMAGE = {
  image_key: "prototype/radiator",
  original: "/prototype/radiator.jpg",
  display: "/prototype/radiator.jpg",
};

const BRANCH = { candidateNo: 1, candidateCount: 1 };

/** 语音输入转写出来的那句话 */
export const VOICE_TRANSCRIPT = "The bedroom is freezing even with the heating on full.";
export const REPLY =
  "Good. Now say it plainly — the radiator never gets warm, not even in the evening.";
export const CONTINUE_LINE =
  "Then send him three lines. Short ones. I'll check your wording after you hit send.";

export function seedMessages(): Message[] {
  return [
    {
      id: "m1",
      role: "assistant",
      content: "Hey, I'm Your Favorite. What do you want to practise today?",
      ...BRANCH,
      isGreeting: true,
    },
    {
      id: "m2",
      role: "user",
      content: "I want to sound less stiff when I speak English.",
      ...BRANCH,
    },
    {
      id: "m3",
      role: "assistant",
      content:
        "Then let's practise on real things. Tell me one thing that annoyed you this week.",
      ...BRANCH,
    },
    {
      id: "m4",
      role: "user",
      content: "My landlord ignored three emails about the heating. This is the radiator.",
      images: [CHAT_IMAGE],
      ...BRANCH,
    },
    {
      id: "m5",
      role: "assistant",
      content: "Radiators are honest machines. Describe the flat as if you were renting it out.",
      ...BRANCH,
    },
  ];
}

export const FEEDBACK_CARD: FeedbackCard = {
  surface: "The bedroom is freezing even with the heating on full.",
  zh: "就算暖气开到最大，卧室还是冷得要命。",
  key_phrases: [
    { surface: "freezing", ipa_us: "/ˈfriːzɪŋ/", zh: "冷得要命的（口语夸张）" },
    { surface: "even with", ipa_us: "/ˈiːvn wɪð/", zh: "即使有……也" },
  ],
  favorite: { enabled: true, is_favorited: false, saved_item_id: null },
};

export const REPLY_CARD: ReplyCard = {
  surface:
    "Good. Now say it plainly — the radiator never gets warm, not even in the evening.",
  zh: "好。现在把它说得直白一点——暖气片从来就没热过，晚上也一样。",
  key_phrases: [
    { surface: "plainly", ipa_us: "/ˈpleɪnli/", zh: "直白地；不加修饰地" },
    { surface: "not even", ipa_us: "/nɒt ˈiːvn/", zh: "连……都不" },
  ],
  favorite: { enabled: true, is_favorited: false, saved_item_id: null },
};

// ── AI 创建角色 ────────────────────────────────────────────────────────────
// 这一幕里的角色信息全部用英文：角色名、简介、音色、形象说明、AI 的思考与工具行。

export const FORGE_PROMPT = "A woman in her forties who restores old books in London";

export const FORGE_VOICE_PREVIEW: ForgeVoicePreviewPayload = {
  type: "voice_preview",
  preview_id: "preview-lin",
  preview_url: "prototype/preview-lin",
  base_voice_id: "demo-voice",
  display_name: "Warm female voice",
  usage_hint: "a little slow, good for storytelling",
  gender: "female",
  speech_rate: 0.92,
  volume: 1,
  pitch_rate: 0.96,
  sample_text:
    "This one is from 1893. The paper is brittle, so I'll rebuild the spine before I touch the pages.",
};

export const FORGE_CHARACTER: ForgeCharacterPayload = {
  type: "character_created",
  character_id: "demo-lin",
  chat_id: "demo-chat-lin",
  name: "Lin",
  description:
    "Lin has restored old books in London for twenty years. There is glue under her fingernails that never quite comes off, and she talks slowly until you mention paper.",
  avatar_image_key: "images/avatars/demo/lin",
  visibility: "PRIVATE",
  voice: {
    provider_voice_id: "demo-voice",
    display_name: "Warm female voice",
    usage_hint: "a little slow, good for storytelling",
    gender: "female",
    speech_rate: 0.92,
    volume: 1,
    pitch_rate: 0.96,
  },
};

export const FORGE_THOUGHT =
  "She wants a character who can hold a conversation, not a costume. Give her one habit and one place: glue that never comes off her fingers, a workshop off Columbia Road.";

export function forgeParts(): ForgeMessagePart[] {
  return [
    { type: "thought", text: FORGE_THOUGHT },
    {
      type: "tool",
      event: {
        id: "t1",
        tool: "load_skill",
        label: "Reading the character guide",
        status: "done",
        summary: "3 templates loaded",
      },
    },
    {
      type: "content",
      text: "Start with something she does with her hands: she can tell a book's decade by the smell of its glue.\n\nThe rest can come out in conversation.",
    },
    {
      type: "tool",
      event: {
        id: "t2",
        tool: "preview_voice",
        label: "Choosing a voice",
        status: "done",
        summary: "Warm female voice · 0.92x",
      },
    },
    { type: "payload", payload: FORGE_VOICE_PREVIEW },
    {
      type: "tool",
      event: {
        id: "t3",
        tool: "generate_avatar",
        label: "Generating the portrait",
        status: "done",
        summary: "1 image generated, set as avatar",
      },
    },
    {
      type: "tool",
      event: {
        id: "t4",
        tool: "create_character",
        label: "Saving the character card",
        status: "done",
        summary: "Draft saved",
      },
    },
    { type: "payload", payload: FORGE_CHARACTER },
    {
      type: "content",
      text: "She's ready. Voice, portrait and backstory are set — open the chat and she answers in her own voice.",
    },
  ];
}
