import type { Character } from "@/components/Sidebar";
import type { AvatarUrls } from "./api-service";
import { ApiError, UnauthorizedError } from "./token-store";
import { mapCharacterToSidebar } from "./character-adapter";

/**
 * 全站统一的等待时序。详见 .agent/loading.md。
 * 这些值描述"什么时候给用户什么信息"，不是某个接口的超时时间。
 */
export const LOADING_TIMING = {
  /** 交互必须在此时间内给出可见确认 */
  acknowledgementMs: 100,
  /** 指示器延迟出现，避免 <200ms 的快响应闪一下 */
  indicatorDelayMs: 200,
  /** 指示器一旦出现，至少保持这么久 */
  minVisibleMs: 300,
  /** 超过此耗时，应从局部指示升级为布局一致的骨架 */
  skeletonThresholdMs: 1000,
  /** 超过此耗时，应给出分阶段状态文案与重试入口 */
  longWaitMs: 5000,
  /** 首帧种子的存活时间；超时后不再用于渲染 */
  seedMaxAgeMs: 60_000,
  /** 乐观导航的连点去抖窗口 */
  navigationDebounceMs: 500,
} as const;

export type LoadingTier = "none" | "acknowledgement" | "short" | "skeleton" | "long";

export function loadingTierFor(elapsedMs: number): LoadingTier {
  if (elapsedMs < LOADING_TIMING.acknowledgementMs) return "none";
  if (elapsedMs < LOADING_TIMING.indicatorDelayMs) return "acknowledgement";
  if (elapsedMs < LOADING_TIMING.skeletonThresholdMs) return "short";
  if (elapsedMs < LOADING_TIMING.longWaitMs) return "skeleton";
  return "long";
}

/** 发起页需要交给目标页的最小角色信息 */
export interface ChatEntrySeedInput {
  id: string;
  name: string;
  description: string;
  avatar?: string | null;
  avatar_image_key?: string | null;
  avatar_urls?: AvatarUrls | null;
}

export interface ChatEntrySeed {
  character: Character;
  createdAt: number;
}

/**
 * 种子存在 localStorage 而非 react-query 缓存：
 * 登录流程会执行 queryClient.clear()，缓存种子会被清掉；
 * localStorage 还能覆盖页面刷新和跨设备回跳。
 */
const CHARACTER_SEED_PREFIX = "parlasoul:chat-character-seed:v1:";
const CHAT_SEED_PREFIX = "parlasoul:chat-entry-seed:v1:";

function writeSeed(key: string, input: ChatEntrySeedInput): void {
  if (typeof window === "undefined") return;
  try {
    const payload: ChatEntrySeed = {
      character: mapCharacterToSidebar(input),
      createdAt: Date.now(),
    };
    window.localStorage.setItem(key, JSON.stringify(payload));
  } catch {
    // 隐私模式下 localStorage 可能不可用；降级为纯骨架，不影响功能
  }
}

function readSeed(key: string): Character | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const seed = JSON.parse(raw) as ChatEntrySeed;
    if (!seed?.character?.id) return null;
    if (Date.now() - seed.createdAt > LOADING_TIMING.seedMaxAgeMs) {
      window.localStorage.removeItem(key);
      return null;
    }
    return seed.character;
  } catch {
    return null;
  }
}

function removeSeed(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

function characterSeedKey(characterId: string) {
  return `${CHARACTER_SEED_PREFIX}${characterId}`;
}

function chatSeedKey(chatId: string) {
  return `${CHAT_SEED_PREFIX}${chatId}`;
}

/** 乐观导航：点击时还没有 chatId，先按 characterId 存 */
export function seedCharacterEntry(input: ChatEntrySeedInput): void {
  writeSeed(characterSeedKey(input.id), input);
}

export function readCharacterSeed(characterId: string | null | undefined): Character | null {
  if (!characterId) return null;
  return readSeed(characterSeedKey(characterId));
}

export function clearCharacterSeed(characterId: string): void {
  removeSeed(characterSeedKey(characterId));
}

/** /chat/new 解析出 chatId 后迁移，供 /chat/[id] 首帧使用 */
export function seedChatEntry(chatId: string, character: Character): void {
  writeSeed(chatSeedKey(chatId), character);
}

export function readChatEntrySeed(chatId: string | null | undefined): Character | null {
  if (!chatId) return null;
  return readSeed(chatSeedKey(chatId));
}

export function clearChatEntrySeed(chatId: string): void {
  removeSeed(chatSeedKey(chatId));
}

/**
 * 只有确定无法恢复的错误才立刻呈现失败态。
 * 4xx（除 401/408/429）是终态；401 多为登录刚完成时的 JWT 竞态，可重试；
 * 网络错误 / 5xx / 请求取消都属于瞬时故障。
 * 详见 .agent/loading.md §8。
 */
export function isTerminalLoadingError(error: unknown): boolean {
  if (error instanceof ApiError) {
    if (error.status === 401 || error.status === 408 || error.status === 429) {
      return false;
    }
    return error.status >= 400 && error.status < 500;
  }
  return false;
}

export function loadingFailureMessage(error: unknown): string {
  if (error instanceof UnauthorizedError) {
    return "登录状态已过期，请重新登录";
  }
  if (error instanceof ApiError) {
    if (error.status === 403 || error.status === 404) {
      return "这个角色暂时无法进入";
    }
    if (error.status >= 500) {
      return "服务暂时不可用，请稍后重试";
    }
  }
  return "连接不稳定，暂时无法进入对话";
}
