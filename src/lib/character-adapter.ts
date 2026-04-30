import type { Character } from "@/components/Sidebar";
import type {
    CharacterStatus,
    CharacterVisibility,
    AvatarUrls,
    VoiceSelectableItem,
} from "./api-service";
import { resolveCharacterAvatarSrc } from "./character-avatar";

interface CharacterLike {
    id: string;
    name: string;
    description: string;
    system_prompt?: string;
    greeting_message?: string;
    avatar_image_key?: string | null;
    avatar_urls?: AvatarUrls | null;
    status?: CharacterStatus;
    unpublished_at?: string | null;
    visibility?: CharacterVisibility;
    creator_id?: string | null;
    creator_username?: string | null;
    llm_preset_id?: string | null;
    dialogue_style_id?: string | null;
    voice_provider?: string;
    voice_model?: string;
    voice_provider_voice_id?: string;
    voice_source_type?: VoiceSelectableItem["source_type"];
    voice?: VoiceSelectableItem | null;
    distinct_user_count?: number;
}

export function mapCharacterToSidebar(
    source: CharacterLike,
): Character {
    return {
        id: source.id,
        name: source.name,
        description: source.description,
        avatar: resolveCharacterAvatarSrc(source, "md"),
        avatar_image_key: source.avatar_image_key ?? null,
        avatar_urls: source.avatar_urls ?? null,
        system_prompt: source.system_prompt,
        greeting_message: source.greeting_message,
        status: source.status,
        unpublished_at: source.unpublished_at ?? null,
        visibility: source.visibility,
        creator_id: source.creator_id ?? null,
        creator_username: source.creator_username ?? null,
        llm_preset_id: source.llm_preset_id,
        dialogue_style_id: source.dialogue_style_id,
        voice_provider: source.voice_provider,
        voice_model: source.voice_model,
        voice_provider_voice_id: source.voice_provider_voice_id,
        voice_source_type: source.voice_source_type,
        voice: source.voice ?? undefined,
        distinct_user_count: source.distinct_user_count ?? 0,
    };
}
