import type {
  AvatarUrls,
  VoiceProfile,
  VoiceSelectableItem,
  VoiceStatus,
  VoiceSourceType,
} from "./api-service";

export interface VoiceDisplayInfo {
  id: string;
  displayName: string;
  description: string;
  provider: string;
  providerModel: string | null;
  providerVoiceId: string;
  sourceType: VoiceSourceType;
  avatarImageKey: string | null;
  avatarUrls: AvatarUrls | null;
  previewText: string | null;
  previewAudioUrl: string | null;
  isSystem: boolean;
  boundCharacterCount: number;
}

export function getVoiceDescription(item: VoiceSelectableItem | VoiceProfile): string {
  if (item.source_type === "system") {
    return item.source_type === "system" && "usage_hint" in item
      ? (item as VoiceSelectableItem).usage_hint || ""
      : "";
  }
  return "description" in item ? item.description || "" : "";
}

export function canUseVoice(status: VoiceStatus | undefined | null): boolean {
  return status === "ready";
}

export function canDeleteVoice(status: VoiceStatus | undefined | null): boolean {
  return status === "ready" || status === "failed";
}

export function mapVoiceSelectableToDisplay(
  item: VoiceSelectableItem
): VoiceDisplayInfo {
  return {
    id: item.id,
    displayName: item.display_name,
    description: getVoiceDescription(item),
    provider: item.provider,
    providerModel: item.provider_model,
    providerVoiceId: item.provider_voice_id,
    avatarImageKey: item.avatar_image_key ?? null,
    avatarUrls: item.avatar_urls ?? null,
    previewText: item.preview_text ?? null,
    sourceType: item.source_type,
    previewAudioUrl: item.preview_audio_url,
    isSystem: item.source_type === "system",
    boundCharacterCount: 0,
  };
}

export function mapVoiceProfileToDisplay(
  profile: VoiceProfile
): VoiceDisplayInfo {
  return {
    id: profile.id,
    displayName: profile.display_name,
    description: profile.description || "",
    provider: profile.provider,
    providerModel: profile.provider_model,
    providerVoiceId: profile.provider_voice_id,
    avatarImageKey: profile.avatar_image_key ?? null,
    avatarUrls: profile.avatar_urls ?? null,
    previewText: profile.preview_text ?? null,
    sourceType: profile.source_type,
    previewAudioUrl: profile.preview_audio_url,
    isSystem: profile.source_type === "system",
    boundCharacterCount: profile.bound_character_count ?? 0,
  };
}

export interface VoiceGroup {
  label: string;
  voices: VoiceDisplayInfo[];
}

export function groupVoicesBySource(
  voices: VoiceSelectableItem[]
): VoiceGroup[] {
  const systemVoices = voices
    .filter((v) => v.source_type === "system")
    .map(mapVoiceSelectableToDisplay);

  const myCloneVoices = voices
    .filter((v) => v.source_type === "clone")
    .map(mapVoiceSelectableToDisplay);

  const groups: VoiceGroup[] = [];

  if (systemVoices.length > 0) {
    groups.push({ label: "系统音色", voices: systemVoices });
  }

  if (myCloneVoices.length > 0) {
    groups.push({ label: "我的克隆", voices: myCloneVoices });
  }

  return groups;
}

export interface VoiceCardDisplay {
  id: string;
  displayName: string;
  description: string;
  avatarImageKey: string | null;
  avatarUrls: AvatarUrls | null;
  previewText: string | null;
  sourceType: VoiceSourceType;
  previewAudioUrl: string | null;
  canPreview: boolean;
  canDelete: boolean;
  boundCharacterCount: number;
}

export function mapVoiceProfileToCardDisplay(
  profile: VoiceProfile
): VoiceCardDisplay {
  return {
    id: profile.id,
    displayName: profile.display_name,
    description: profile.description || "",
    avatarImageKey: profile.avatar_image_key ?? null,
    avatarUrls: profile.avatar_urls ?? null,
    previewText: profile.preview_text ?? null,
    sourceType: profile.source_type,
    previewAudioUrl: profile.preview_audio_url,
    canPreview:
      canUseVoice(profile.status) &&
      Boolean(profile.preview_audio_url || profile.preview_text),
    canDelete: canDeleteVoice(profile.status),
    boundCharacterCount: profile.bound_character_count ?? 0,
  };
}
