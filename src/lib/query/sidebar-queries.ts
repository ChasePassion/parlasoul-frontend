import { useQuery } from "@tanstack/react-query";
import { getSidebarCharacters } from "@/lib/api";
import { queryKeys } from "./query-keys";

export function useSidebarCharactersQuery(userId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.sidebar.characters(userId),
    queryFn: ({ signal }) => getSidebarCharacters({ signal }),
    enabled: Boolean(userId),
  });
}
