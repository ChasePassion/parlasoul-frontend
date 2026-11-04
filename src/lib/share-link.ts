export function slugifyName(name: string): string {
  return (
    name
      .toLocaleLowerCase()
      .replace(/[\s\p{P}]+/gu, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 128) || "character"
  );
}

export function generateCharacterSlug(
  name: string,
  characterId: string,
): string {
  return `${slugifyName(name)}-${characterId}`;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseUuidFromSlug(slug: string): string | null {
  if (slug.length < 36) return null;
  const candidate = slug.slice(-36);
  return UUID_RE.test(candidate) ? candidate : null;
}

export function buildShareUrl(name: string, characterId: string): string {
  const origin =
    typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/share/${generateCharacterSlug(name, characterId)}`;
}
