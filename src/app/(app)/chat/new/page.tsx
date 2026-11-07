"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/lib/auth-context";
import { recentChatQueryOptions, resolveChatId } from "@/lib/query";
import { UnauthorizedError } from "@/lib/token-store";
import { clearBetterAuthJwt } from "@/lib/better-auth-token";
import {
  clearCharacterSeed,
  isTerminalLoadingError,
  loadingFailureMessage,
  readCharacterSeed,
  seedChatEntry,
} from "@/lib/loading";
import ChatLoadingView from "@/components/ChatLoadingView";

type ResolvePhase = "resolving" | "failed";

const MAX_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [250, 700];

/**
 * 乐观导航的落地页。
 * 首帧：真实角色 header（来自发起页种子）+ 与 /chat/[id] 完全一致的消息/输入框骨架。
 * 后台：解析 chatId（hover 预取通常已命中缓存），拿到后 replace 到正式 URL。
 *
 * 瞬时故障自动重试，不打断用户；只有重试耗尽或终态错误才在骨架内呈现
 * 带重试入口的失败态（见 .agent/loading.md §8）。
 */
function NewChatEntryContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const characterId = searchParams.get("character");
  // 必须缓存：readCharacterSeed 每次调用都会 JSON.parse 出新对象，
  // 若作为 resolve 的依赖会导致 useCallback 每次 render 都变、effect 隐式重试。
  const character = useMemo(() => readCharacterSeed(characterId), [characterId]);
  const [phase, setPhase] = useState<ResolvePhase>("resolving");
  const [message, setMessage] = useState<string>("");
  const [attempt, setAttempt] = useState(0);
  // 防止 React StrictMode / 重渲染重复创建 chat（create 有副作用）
  const inFlightRef = useRef(false);

  const resolve = useCallback(async () => {
    if (!characterId || !user?.id || inFlightRef.current) return;
    inFlightRef.current = true;
    setPhase("resolving");

    try {
      for (let index = 0; index < MAX_ATTEMPTS; index += 1) {
        try {
          const chatId = await resolveChatId(queryClient, user.id, characterId);
          // 迁移种子：正式聊天页首帧也能渲染真实 header
          if (character) {
            seedChatEntry(chatId, character);
          }
          clearCharacterSeed(characterId);
          router.replace(`/chat/${chatId}`);
          return;
        } catch (error) {
          const terminal = isTerminalLoadingError(error);
          const exhausted = index === MAX_ATTEMPTS - 1;

          // 401 时清掉 JWT 缓存，让下次请求强制刷新 token
          if (error instanceof UnauthorizedError) {
            clearBetterAuthJwt();
          }

          if (terminal || exhausted) {
            console.error("Failed to resolve chat for optimistic entry:", error);
            setMessage(loadingFailureMessage(error));
            setPhase("failed");
            return;
          }

          // 重试前清掉可能被预取污染的缓存，保证重新查 recent，避免重复 create
          queryClient.removeQueries({
            queryKey: recentChatQueryOptions(user.id, characterId).queryKey,
            exact: true,
          });
          await new Promise<void>((done) =>
            setTimeout(done, RETRY_DELAYS_MS[index] ?? RETRY_DELAYS_MS[0]),
          );
        }
      }
    } finally {
      inFlightRef.current = false;
    }
  }, [character, characterId, queryClient, router, user?.id]);

  useEffect(() => {
    void resolve();
  }, [resolve, attempt]);

  const retry = useCallback(() => {
    setAttempt((value) => value + 1);
  }, []);

  return (
    <ChatLoadingView
      character={character}
      failure={phase === "failed" ? { message, onRetry: retry } : undefined}
    />
  );
}

export default function NewChatEntryPage() {
  return (
    <Suspense fallback={<ChatLoadingView />}>
      <NewChatEntryContent />
    </Suspense>
  );
}
