import type { User } from "./api-service";

type BetterAuthUserLike = {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
  emailVerified?: boolean | null;
  createdAt?: Date | string | null;
  lastLoginAt?: Date | string | null;
  username?: string | null;
};

type BetterAuthSessionLike = {
  user: BetterAuthUserLike;
} | null;

function toOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function toIsoString(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  return new Date(0).toISOString();
}

export function mapBetterAuthUserToUser(
  user: BetterAuthUserLike | null | undefined,
): User | null {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    username: toOptionalString(user.username),
    email_verified: Boolean(user.emailVerified),
    avatar_url: toOptionalString(user.image),
    created_at: toIsoString(user.createdAt),
    last_login_at: user.lastLoginAt ? toIsoString(user.lastLoginAt) : undefined,
  };
}

export function mapBetterAuthSessionToUser(
  session: BetterAuthSessionLike,
): User | null {
  return mapBetterAuthUserToUser(session?.user);
}
