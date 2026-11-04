import { getRealtimeIceConfig, type RealtimeIceConfigResponse } from "@/lib/api";
import { queryKeys } from "./query-keys";

const SECOND_MS = 1000;
const MINUTE_MS = 60 * SECOND_MS;
const ICE_CONFIG_MAX_STALE_MS = 5 * MINUTE_MS;
const ICE_CONFIG_TTL_SAFETY_MARGIN_MS = 60 * SECOND_MS;

export function getRealtimeIceConfigCacheMs(
  config: RealtimeIceConfigResponse,
): number {
  const ttlMs = Math.max(0, config.credential_ttl_seconds * SECOND_MS);
  if (ttlMs <= ICE_CONFIG_TTL_SAFETY_MARGIN_MS) {
    return 0;
  }

  return Math.min(
    ICE_CONFIG_MAX_STALE_MS,
    ttlMs - ICE_CONFIG_TTL_SAFETY_MARGIN_MS,
  );
}

export function realtimeIceConfigQueryOptions(
  userId: string | null | undefined,
) {
  return {
    queryKey: queryKeys.realtime.iceConfig(userId),
    queryFn: ({ signal }: { signal?: AbortSignal }) =>
      getRealtimeIceConfig({ signal }),
    // staleTime intentionally uses the max cap; actual realtime calls
    // use getRealtimeIceConfigCacheMs() for precise response-aware TTL.
    staleTime: ICE_CONFIG_MAX_STALE_MS,
  };
}
