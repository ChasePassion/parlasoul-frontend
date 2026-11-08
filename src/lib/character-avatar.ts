import type { AvatarUrls } from "./api-service";

const DEFAULT_CHARACTER_AVATAR = "/default-avatar.svg";

export type AvatarSize = "sm" | "md" | "lg" | "xl";

export interface AvatarSource {
  name?: string | null;
  avatar_urls?: AvatarUrls | null;
  avatar_image_key?: string | null;
}

const SIZE_TO_FILE: Record<AvatarSize, string> = {
  sm: "96.avif",
  md: "192.avif",
  lg: "512.avif",
  xl: "512.avif",
};

const BUILT_IN_CHARACTER_AVATARS: Array<{
  src: string;
  matches: (normalizedName: string) => boolean;
}> = [
  {
    src: "/Elon.png",
    matches: (name) => name.includes("elon"),
  },
  {
    src: "/Gork.png",
    matches: (name) => name.includes("gork"),
  },
  {
    src: "/Bai.png",
    matches: (name) =>
      name.includes("xiao bai") ||
      name.includes("xiaobai") ||
      name.includes("小白"),
  },
];

export function isR2AvatarImageKey(value?: string | null): value is string {
  return Boolean(value?.trim().startsWith("images/avatars/"));
}

function mediaBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_MEDIA_BASE_URL?.trim() || "/media").replace(/\/$/, "");
}

function resolveAvatarUrls(avatarUrls: AvatarUrls | null | undefined, size: AvatarSize): string | undefined {
  if (!avatarUrls) {
    return undefined;
  }
  return avatarUrls[size] || avatarUrls.md || avatarUrls.lg || avatarUrls.sm || avatarUrls.xl;
}

function normalizeCharacterName(value: string): string {
  return value.toLocaleLowerCase().replace(/\s+/g, " ").trim();
}

function resolveBuiltInCharacterAvatar(source: AvatarSource): string | undefined {
  const name = source.name?.trim();
  if (!name) {
    return undefined;
  }

  const normalizedName = normalizeCharacterName(name);
  return BUILT_IN_CHARACTER_AVATARS.find((asset) => asset.matches(normalizedName))?.src;
}

export function resolveAvatarSrc(
  source?: AvatarSource | string | null,
  size: AvatarSize = "md",
): string | undefined {
  if (!source) {
    return undefined;
  }

  if (typeof source === "string") {
    if (isR2AvatarImageKey(source)) {
      return `${mediaBaseUrl()}/${source}/${SIZE_TO_FILE[size]}`;
    }
    return undefined;
  }

  const fromUrls = resolveAvatarUrls(source.avatar_urls, size);
  if (fromUrls) {
    return fromUrls;
  }

  if (source.avatar_image_key) {
    return `${mediaBaseUrl()}/${source.avatar_image_key}/${SIZE_TO_FILE[size]}`;
  }

  return undefined;
}

export function resolveCharacterAvatarSrc(
  source?: AvatarSource | string | null,
  size: AvatarSize = "md",
): string {
  const resolved = resolveAvatarSrc(source, size);
  if (resolved) {
    return resolved;
  }

  if (source && typeof source === "object") {
    const builtInAvatar = resolveBuiltInCharacterAvatar(source);
    if (builtInAvatar) {
      return builtInAvatar;
    }
  }

  return DEFAULT_CHARACTER_AVATAR;
}

export function resolveVoiceAvatarSrc(
  source?: AvatarSource | string | null,
  size: AvatarSize = "md",
): string {
  return resolveAvatarSrc(source, size) ?? DEFAULT_CHARACTER_AVATAR;
}

export interface UserAvatarSource {
  avatar_urls?: AvatarUrls | null;
  avatar_image_key?: string | null;
  avatar_url?: string | null;
}

/**
 * 用户头像：上传/生成的图（avatar_urls / avatar_image_key）优先，
 * 其次是注册时分配的预设头像（avatar_url），最后才是灰色占位图。
 *
 * avatar_url 只认 /avatars/default/ 下的预设图：历史数据里这个字段存过
 * 早期的本地上传路径（/uploads/...），那些文件已经不在了，不能直接渲染。
 */
export function resolveUserAvatarSrc(
  user?: UserAvatarSource | null,
  size: AvatarSize = "md",
): string {
  if (!user) {
    return DEFAULT_CHARACTER_AVATAR;
  }

  const uploaded = resolveAvatarSrc(
    { avatar_urls: user.avatar_urls, avatar_image_key: user.avatar_image_key },
    size,
  );
  if (uploaded) {
    return uploaded;
  }

  const preset = user.avatar_url?.trim();
  if (preset?.startsWith("/avatars/default/")) {
    return preset;
  }

  return DEFAULT_CHARACTER_AVATAR;
}
