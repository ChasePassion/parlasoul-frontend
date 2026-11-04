import type { QueryClient } from "@tanstack/react-query";
import { createChatInstance } from "./api";
import { queryKeys, recentChatQueryOptions } from "./query";

export async function getOrCreateChatId(
    queryClient: QueryClient,
    userId: string | null | undefined,
    characterId: string,
): Promise<string> {
    const recent = await queryClient.fetchQuery(
        recentChatQueryOptions(userId, characterId),
    );
    if (recent?.chat?.id) return recent.chat.id;

    return createNewChatId(queryClient, userId, characterId);
}

export async function createNewChatId(
    queryClient: QueryClient,
    userId: string | null | undefined,
    characterId: string,
): Promise<string> {
    const created = await createChatInstance({ character_id: characterId });
    queryClient.setQueryData(queryKeys.chats.recent(userId, characterId), {
        chat: created.chat,
        character: created.character,
    });
    await Promise.all([
        queryClient.invalidateQueries({
            queryKey: queryKeys.sidebar.characters(userId),
        }),
        queryClient.invalidateQueries({
            queryKey: queryKeys.chats.history(userId, characterId),
        }),
    ]);
    return created.chat.id;
}
