import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteSavedItem, listSavedItemsPhase3 } from "@/lib/api";
import type { SavedItemKindPhase3 } from "@/lib/api-service";
import { queryKeys, type SavedItemListParams } from "./query-keys";

export function useSavedItemsInfiniteQuery(
  userId: string | null | undefined,
  params: Omit<SavedItemListParams, "cursor"> = {},
) {
  return useInfiniteQuery({
    queryKey: queryKeys.savedItems.list(userId, params),
    queryFn: ({ pageParam, signal }) =>
      listSavedItemsPhase3(
        {
          kind: params.kind as SavedItemKindPhase3 | undefined,
          role_id: params.roleId,
          chat_id: params.chatId,
          cursor: pageParam,
          limit: params.limit ?? 20,
        },
        { signal },
      ),
    enabled: Boolean(userId),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
  });
}

export function useDeleteSavedItemMutation(userId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteSavedItem(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.savedItems.all(userId),
      });
    },
  });
}
