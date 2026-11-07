import {
  useInfiniteQuery,
  type QueryClient,
} from "@tanstack/react-query";
import {
  createChatInstance,
  getChatTurns,
  getRecentChat,
  listChats,
} from "@/lib/api";
import type { ChatTurnsParams } from "./query-keys";
import { queryKeys } from "./query-keys";

export function recentChatQueryOptions(
  userId: string | null | undefined,
  characterId: string,
) {
  return {
    queryKey: queryKeys.chats.recent(userId, characterId),
    queryFn: ({ signal }: { signal?: AbortSignal }) =>
      getRecentChat(characterId, { signal }),
  };
}

export function chatTurnsQueryOptions(
  userId: string | null | undefined,
  chatId: string,
  params: ChatTurnsParams = {},
) {
  return {
    queryKey: queryKeys.chats.turns(userId, chatId, params),
    queryFn: ({ signal }: { signal?: AbortSignal }) =>
      getChatTurns(chatId, {
        before_turn_id: params.beforeTurnId ?? undefined,
        include_learning_data: params.includeLearningData,
        limit: params.limit,
        signal,
      }),
    // 聊天消息必须拿到最新内容，不能靠调大 staleTime 消除加载态。
    // 首帧由缓存种子接管，见 .agent/loading.md。
    staleTime: 0,
  };
}

export function chatHistoryQueryOptions(
  userId: string | null | undefined,
  characterId: string,
  limit = 20,
) {
  return {
    queryKey: queryKeys.chats.history(userId, characterId, limit),
    queryFn: ({ pageParam, signal }: { pageParam?: string; signal?: AbortSignal }) =>
      listChats(
        {
          character_id: characterId,
          cursor: pageParam,
          limit,
        },
        { signal },
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage: { next_cursor?: string | null }) =>
      lastPage.next_cursor ?? undefined,
  };
}

export function useChatHistoryInfiniteQuery(
  userId: string | null | undefined,
  characterId: string | null | undefined,
  enabled = true,
  limit = 20,
) {
  return useInfiniteQuery({
    ...chatHistoryQueryOptions(userId, characterId ?? "unknown", limit),
    enabled: Boolean(userId && characterId) && enabled,
  });
}

/**
 * 取得（或创建）某个角色的 chatId。全站唯一实现。
 *
 * invalidateQueries 属于后台刷新，与 chatId 无关，绝不能 await 在返回之前：
 * 否则导航会多等 2 个 active refetch（见 .agent/loading.md §3.3）。
 */
export async function resolveChatId(
  queryClient: QueryClient,
  userId: string | null | undefined,
  characterId: string,
): Promise<string> {
  const existing = await queryClient.fetchQuery(
    recentChatQueryOptions(userId, characterId),
  );

  if (existing?.chat?.id) {
    return existing.chat.id;
  }

  const created = await createChatInstance({ character_id: characterId });
  queryClient.setQueryData(queryKeys.chats.recent(userId, characterId), {
    chat: created.chat,
    character: created.character,
  });

  // 后台刷新，失败静默；不阻塞导航。
  void Promise.all([
    queryClient.invalidateQueries({
      queryKey: queryKeys.sidebar.characters(userId),
    }),
    queryClient.invalidateQueries({
      queryKey: queryKeys.chats.history(userId, characterId),
    }),
  ]).catch((error) => {
    console.error("Failed to refresh chat lists after create:", error);
  });

  return created.chat.id;
}
