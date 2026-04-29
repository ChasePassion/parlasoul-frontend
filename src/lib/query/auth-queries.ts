import { useQuery } from "@tanstack/react-query";
import { getMyEntitlements, getMyProfile } from "@/lib/api";
import { queryKeys } from "./query-keys";

export function useUserProfileQuery(userId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.user.profile(userId),
    queryFn: ({ signal }) => getMyProfile({ signal }),
    enabled: Boolean(userId),
  });
}

export function useUserEntitlementsQuery(userId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.auth.entitlements(userId),
    queryFn: ({ signal }) => getMyEntitlements({ signal }),
    enabled: Boolean(userId),
  });
}
