import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
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

export function useGetOrCreateChatMutation(userId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (characterId: string) => {
      const existing = await queryClient.fetchQuery(
        recentChatQueryOptions(userId, characterId),
      );

      if (existing?.chat?.id) {
        return existing.chat.id;
      }

      const created = await createChatInstance({ character_id: characterId });
      queryClient.setQueryData(
        queryKeys.chats.recent(userId, characterId),
        {
          chat: created.chat,
          character: created.character,
        },
      );

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.sidebar.characters(userId),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.chats.history(userId, characterId),
        }),
      ]);

      return created.chat.id;
    },
  });
}
