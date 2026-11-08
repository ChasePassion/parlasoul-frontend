/**
 * 注册时写入的默认资料。
 *
 * 用户名取邮箱本地部（去掉 +tag，只保留安全字符），冲突时加数字后缀；
 * 头像按邮箱哈希确定性地挑一张预设头像，同一邮箱永远是同一张，重试与回填都幂等。
 */

export const PRESET_AVATAR_PREFIX = "/avatars/default/";
export const PRESET_AVATAR_COUNT = 10;

const USERNAME_MAX_LENGTH = 45;

export function resolvePresetAvatarUrl(email: string): string {
  let hash = 0;
  for (const char of email.trim().toLowerCase()) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  const index = (hash % PRESET_AVATAR_COUNT) + 1;
  return `${PRESET_AVATAR_PREFIX}avatar-${String(index).padStart(2, "0")}.webp`;
}

export function normalizeUsernameBase(email: string): string {
  const localPart = email.split("@")[0] ?? "";
  const withoutTag = localPart.split("+")[0] ?? "";
  const cleaned = withoutTag
    .toLowerCase()
    .replace(/[^a-z0-9._\-\u4e00-\u9fff]/g, "")
    .slice(0, USERNAME_MAX_LENGTH);
  return cleaned.padEnd(2, "_");
}

interface UsernameLookup {
  query(
    text: string,
    values: unknown[],
  ): Promise<{ rowCount: number | null }>;
}

export async function resolveUniqueUsername(
  pool: UsernameLookup,
  base: string,
): Promise<string> {
  for (const candidate of [base, `${base}2`, `${base}3`, `${base}4`]) {
    const result = await pool.query(
      "SELECT 1 FROM users WHERE username = $1 LIMIT 1",
      [candidate],
    );
    if (!result.rowCount) {
      return candidate;
    }
  }
  return `${base}${Math.floor(1000 + Math.random() * 9000)}`;
}
