import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getMySettings, updateMySettings } from "@/lib/api";
import type {
  UpdateUserSettingsRequest,
  UserSettingsResponse,
} from "@/lib/api-service";
import { queryKeys } from "./query-keys";

export function useUserSettingsQuery(userId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.user.settings(userId),
    queryFn: ({ signal }) => getMySettings({ signal }),
    enabled: Boolean(userId),
  });
}

export function useUpdateUserSettingsMutation(
  userId: string | null | undefined,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: UpdateUserSettingsRequest) => updateMySettings(payload),
    onSuccess: (settings: UserSettingsResponse) => {
      queryClient.setQueryData(queryKeys.user.settings(userId), settings);
    },
  });
}
