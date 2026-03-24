const DEFAULT_CHARACTER_AVATAR = "/default-avatar.svg";

function isAbsoluteAvatarUrl(value: string): boolean {
  return (
    value.startsWith("/") ||
    value.startsWith("data:") ||
    value.startsWith("blob:") ||
    /^[a-z][a-z0-9+.-]*:\/\//i.test(value)
  );
}

export function resolveStoredAvatarSrc(avatarFileName?: string | null): string | undefined {
  if (!avatarFileName) {
    return undefined;
  }

  if (isAbsoluteAvatarUrl(avatarFileName)) {
    return avatarFileName;
  }

  return `/uploads/${avatarFileName}`;
}

export function resolveCharacterAvatarSrc(avatarFileName?: string | null): string {
  return resolveStoredAvatarSrc(avatarFileName) ?? DEFAULT_CHARACTER_AVATAR;
}

export function resolveVoiceAvatarSrc(avatarFileName?: string | null): string | undefined {
  return resolveStoredAvatarSrc(avatarFileName);
}
