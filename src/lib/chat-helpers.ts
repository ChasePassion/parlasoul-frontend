import { createChatInstance, getRecentChat } from "./api";

export async function getOrCreateChatId(characterId: string): Promise<string> {
    const recent = await getRecentChat(characterId);
    if (recent?.chat?.id) return recent.chat.id;

    return createNewChatId(characterId);
}

export async function createNewChatId(characterId: string): Promise<string> {
    const created = await createChatInstance({ character_id: characterId });
    return created.chat.id;
}
