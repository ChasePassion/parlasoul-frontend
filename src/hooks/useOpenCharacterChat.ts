"use client";

import { useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/lib/auth-context";
import { recentChatQueryOptions } from "@/lib/query";
import {
  LOADING_TIMING,
  seedCharacterEntry,
  type ChatEntrySeedInput,
} from "@/lib/loading";
import { setResumeCharacterId } from "@/lib/pending-chat";

export interface OpenCharacterChatOptions {
  /** 访客登录后的回跳地址，默认发现页 */
  nextPath?: string;
}

/** 发起页有完整角色对象时传对象；只有 id 时（例如登录续接）传字符串 */
export type OpenCharacterTarget = ChatEntrySeedInput | string;

export interface OpenCharacterChatResult {
  /**
   * 乐观导航：立即跳转 /chat/new，不在发起页等待网络。
   * 返回是否真的发起了导航；被连点去抖拦下时返回 false，
   * 调用方据此决定要不要消费续接意图。
   */
  open: (target: OpenCharacterTarget, options?: OpenCharacterChatOptions) => boolean;
  /** hover / focus / 视口进入时预取该角色的 recent chat，让 /chat/new 命中热缓存 */
  prefetchOnIntent: (characterId: string) => void;
}

/**
 * 全站唯一"点角色 -> 进入聊天"入口。
 *
 * 采用乐观导航：点击后不做任何网络等待、不在发起页显示加载覆盖层，立即跳到
 * /chat/new?character=<id>。目标页首帧用 localStorage 种子渲染真实角色 header
 * 与同形骨架，chatId 在后台解析完后 replace 到正式 URL。
 * 详见 .agent/loading.md。
 */
export function useOpenCharacterChat(): OpenCharacterChatResult {
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  const prefetchedRef = useRef<Set<string>>(new Set());
  // 短时去抖防止连点产生多条 /chat/new 历史记录；不永久锁死，
  // 用户按返回回到发起页后仍可再次点击。
  const lastNavigationAtRef = useRef(0);

  const prefetchOnIntent = useCallback(
    (characterId: string) => {
      if (!user?.id || prefetchedRef.current.has(characterId)) return;
      prefetchedRef.current.add(characterId);
      void queryClient
        .prefetchQuery(recentChatQueryOptions(user.id, characterId))
        .catch(() => {
          // 预取失败静默，但必须清掉缓存里的错误状态：
          // 否则 /chat/new 的 fetchQuery 会复用这个失败的在飞结果，直接报错。
          prefetchedRef.current.delete(characterId);
          queryClient.removeQueries({
            queryKey: recentChatQueryOptions(user.id, characterId).queryKey,
            exact: true,
          });
        });
    },
    [queryClient, user?.id],
  );

  const open = useCallback(
    (target: OpenCharacterTarget, options: OpenCharacterChatOptions = {}) => {
      const now = Date.now();
      if (now - lastNavigationAtRef.current < LOADING_TIMING.navigationDebounceMs) {
        return false;
      }
      lastNavigationAtRef.current = now;
      const characterId = typeof target === "string" ? target : target.id;

      // 种子用 localStorage，跨过登录流程的 queryClient.clear()
      if (typeof target !== "string") {
        seedCharacterEntry(target);
      }

      if (!user?.id) {
        // 只有"回发现页"的默认路径需要 resume 续接；share 等自带 nextPath 的
        // 页面回跳后会自行重新进入，写 resume id 反而会让布局层重复导航。
        if (!options.nextPath) {
          setResumeCharacterId(characterId);
        }
        const next = options.nextPath ?? "/";
        router.push(`/login?next=${encodeURIComponent(next)}`);
        return true;
      }

      router.push(`/chat/new?character=${encodeURIComponent(characterId)}`);
      return true;
    },
    [router, user?.id],
  );

  return { open, prefetchOnIntent };
}
