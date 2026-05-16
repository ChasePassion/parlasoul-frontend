import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getMyProactiveCharacters,
  replaceMyProactiveCharacters,
} from "@/lib/api";
import type {
  ProactiveCharacterPreferenceListResponse,
  ReplaceProactiveCharacterPreferencesRequest,
} from "@/lib/api-service";
import { queryKeys } from "./query-keys";

export function useMyProactiveCharactersQuery(
  userId: string | null | undefined,
  enabled = true,
) {
  return useQuery({
    queryKey: queryKeys.user.proactiveCharacters(userId),
    queryFn: ({ signal }) => getMyProactiveCharacters({ signal }),
    enabled: Boolean(userId) && enabled,
  });
}

export function useReplaceMyProactiveCharactersMutation(
  userId: string | null | undefined,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: ReplaceProactiveCharacterPreferencesRequest) =>
      replaceMyProactiveCharacters(payload),
    onSuccess: (response: ProactiveCharacterPreferenceListResponse) => {
      queryClient.setQueryData(queryKeys.user.proactiveCharacters(userId), response);
    },
  });
}
