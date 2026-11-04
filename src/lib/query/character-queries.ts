import { useQuery } from "@tanstack/react-query";
import { getMyCharacters, getMarketCharacters } from "@/lib/api";
import {
  fetchAllMarketCharacters,
  getDiscoverConfig,
} from "@/lib/discover-data";
import { queryKeys, type OffsetPageParams } from "./query-keys";

const FIVE_MINUTES = 5 * 60 * 1000;

export function useDiscoverConfigQuery() {
  return useQuery({
    queryKey: [...queryKeys.characters.all(), "discover-config"] as const,
    queryFn: ({ signal }) => getDiscoverConfig({ signal }),
    staleTime: FIVE_MINUTES,
  });
}

export function useMarketCharactersQuery(params: OffsetPageParams = {}) {
  return useQuery({
    queryKey: queryKeys.characters.market(params),
    queryFn: ({ signal }) =>
      getMarketCharacters(params.skip ?? 0, params.limit ?? 20, { signal }),
    staleTime: FIVE_MINUTES,
  });
}

export function useAllMarketCharactersQuery() {
  return useQuery({
    queryKey: queryKeys.characters.marketAll(),
    queryFn: ({ signal }) => fetchAllMarketCharacters({ signal }),
    staleTime: FIVE_MINUTES,
  });
}

export function useMyCharactersQuery(
  userId: string | null | undefined,
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: queryKeys.characters.mine(userId),
    queryFn: ({ signal }) => getMyCharacters({ signal }),
    enabled: Boolean(userId) && (options.enabled ?? true),
  });
}
