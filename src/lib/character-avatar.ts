const DEFAULT_CHARACTER_AVATAR = "/default-avatar.svg";

function isAbsoluteAvatarUrl(value: string): boolean {
  return (
    value.startsWith("/") ||
    value.startsWith("data:") ||
    value.startsWith("blob:") ||
    /^[a-z][a-z0-9+.-]*:\/\//i.test(value)
  );
}

export function resolveCharacterAvatarSrc(
  avatarFileName?: string | null
): string {
  if (!avatarFileName) {
    return DEFAULT_CHARACTER_AVATAR;
  }

  if (isAbsoluteAvatarUrl(avatarFileName)) {
    return avatarFileName;
  }

  return `/uploads/${avatarFileName}`;
}
