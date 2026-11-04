import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  applyGrowthMakeUp,
  consumeGrowthEntry,
  getGrowthCalendar,
  getGrowthChatHeader,
  getGrowthOverview,
  listPendingShareCards,
} from "@/lib/growth-api";
import { queryKeys } from "./query-keys";

export function usePendingShareCardsQuery(
  userId: string | null | undefined,
  params: { chatId?: string | null; limit?: number } = {},
) {
  return useQuery({
    queryKey: queryKeys.growth.pendingShareCards(userId, params.chatId),
    queryFn: ({ signal }) =>
      listPendingShareCards(
        { chat_id: params.chatId ?? undefined, limit: params.limit ?? 10 },
        { signal },
      ),
    enabled: Boolean(userId),
  });
}

export function useConsumeGrowthEntryMutation(
  userId: string | null | undefined,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload?: { calendar_month?: string }) =>
      consumeGrowthEntry(payload),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.growth.entry(userId), data);
      queryClient.setQueryData(
        queryKeys.growth.calendar(userId, data.popup.calendar.month),
        data.popup.calendar,
      );
      void queryClient.invalidateQueries({
        queryKey: queryKeys.growth.overview(userId),
      });
    },
  });
}

export function useGrowthCalendarQuery(
  userId: string | null | undefined,
  month?: string | null,
  enabled = true,
) {
  return useQuery({
    queryKey: queryKeys.growth.calendar(userId, month),
    queryFn: ({ signal }) => getGrowthCalendar(month ?? undefined, { signal }),
    enabled: Boolean(userId) && enabled,
  });
}

export function useApplyGrowthMakeUpMutation(
  userId: string | null | undefined,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (targetDate: string) => applyGrowthMakeUp(targetDate),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.growth.all(userId),
      });
    },
  });
}

export function useGrowthChatHeaderQuery(
  userId: string | null | undefined,
  chatId: string | null | undefined,
  enabled = true,
) {
  return useQuery({
    queryKey: queryKeys.growth.chatHeader(userId, chatId),
    queryFn: ({ signal }) => getGrowthChatHeader(chatId as string, { signal }),
    enabled: Boolean(userId && chatId) && enabled,
  });
}

export function useGrowthOverviewQuery(
  userId: string | null | undefined,
  focusCharacterId?: string | null,
) {
  return useQuery({
    queryKey: queryKeys.growth.overview(userId, focusCharacterId),
    queryFn: ({ signal }) =>
      getGrowthOverview(focusCharacterId ?? undefined, { signal }),
    enabled: Boolean(userId),
  });
}
