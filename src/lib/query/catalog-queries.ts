import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import {
  getVoiceById,
  listMyVoices,
  listSelectableVoices,
} from "@/lib/api";
import type { VoiceStatus, VoiceSourceType } from "@/lib/api-service";
import {
  queryKeys,
  type VoiceCatalogParams,
  type VoiceListParams,
} from "./query-keys";

const FIVE_MINUTES = 5 * 60 * 1000;

export function useSelectableVoicesQuery(
  userId: string | null | undefined,
  params: VoiceCatalogParams = {},
  enabled = true,
) {
  return useQuery({
    queryKey: queryKeys.voices.catalog(userId, params),
    queryFn: ({ signal }) =>
      listSelectableVoices(
        {
          provider: params.provider,
          include_system: params.includeSystem ?? true,
          include_user_custom: params.includeUserCustom ?? true,
        },
        { signal },
      ),
    enabled: Boolean(userId) && enabled,
    staleTime: FIVE_MINUTES,
  });
}

export function useVoiceDetailQuery(
  userId: string | null | undefined,
  voiceId: string | null | undefined,
  enabled = true,
) {
  return useQuery({
    ...voiceDetailQueryOptions(userId, voiceId as string),
    enabled: Boolean(userId && voiceId) && enabled,
    staleTime: FIVE_MINUTES,
  });
}

export function voiceDetailQueryOptions(
  userId: string | null | undefined,
  voiceId: string,
) {
  return {
    queryKey: queryKeys.voices.detail(userId, voiceId),
    queryFn: ({ signal }: { signal?: AbortSignal }) =>
      getVoiceById(voiceId, { signal }),
    staleTime: FIVE_MINUTES,
  };
}

export function useMyVoicesInfiniteQuery(
  userId: string | null | undefined,
  params: Omit<VoiceListParams, "cursor"> = {},
  options: { enabled?: boolean } = {},
) {
  return useInfiniteQuery({
    queryKey: queryKeys.voices.mine(userId, params),
    queryFn: ({ pageParam, signal }) =>
      listMyVoices(
        {
          status: params.status as VoiceStatus | undefined,
          source_type: params.sourceType as VoiceSourceType | undefined,
          cursor: pageParam,
          limit: params.limit ?? 20,
        },
        { signal },
      ),
    enabled: Boolean(userId) && (options.enabled ?? true),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
  });
}
