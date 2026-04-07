import type { Character } from "@/components/Sidebar";
import type {
    CharacterStatus,
    CharacterVisibility,
    LLMProvider,
    VoiceSelectableItem,
} from "./api-service";
import { resolveCharacterAvatarSrc } from "./character-avatar";

interface CharacterLike {
    id: string;
    name: string;
    description: string;
    system_prompt?: string;
    greeting_message?: string;
    avatar_file_name?: string;
    tags?: string[];
    status?: CharacterStatus;
    unpublished_at?: string | null;
    visibility?: CharacterVisibility;
    creator_id?: string | null;
    llm_provider?: LLMProvider | null;
    llm_model?: string | null;
    uses_system_default_llm?: boolean;
    effective_llm_provider?: LLMProvider;
    effective_llm_model?: string;
    voice_provider?: string;
    voice_model?: string;
    voice_provider_voice_id?: string;
    voice_source_type?: VoiceSelectableItem["source_type"];
    voice?: VoiceSelectableItem | null;
}

interface MapCharacterOptions {
    creatorUsername?: string;
}

export function mapCharacterToSidebar(
    source: CharacterLike,
    options: MapCharacterOptions = {}
): Character {
    return {
        id: source.id,
        name: source.name,
        description: source.description,
        avatar: resolveCharacterAvatarSrc(source.avatar_file_name),
        system_prompt: source.system_prompt,
        greeting_message: source.greeting_message,
        tags: source.tags,
        status: source.status,
        unpublished_at: source.unpublished_at ?? null,
        visibility: source.visibility,
        creator_id: source.creator_id ?? undefined,
        creator_username: options.creatorUsername,
        llm_provider: source.llm_provider,
        llm_model: source.llm_model,
        uses_system_default_llm: source.uses_system_default_llm,
        effective_llm_provider: source.effective_llm_provider,
        effective_llm_model: source.effective_llm_model,
        voice_provider: source.voice_provider,
        voice_model: source.voice_model,
        voice_provider_voice_id: source.voice_provider_voice_id,
        voice_source_type: source.voice_source_type,
        voice: source.voice ?? undefined,
    };
}
