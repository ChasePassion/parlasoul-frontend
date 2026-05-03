import type { GrowthShareCard } from "@/lib/growth-types";
import { resolveCharacterAvatarSrc } from "@/lib/character-avatar";

const CARD_WIDTH = 360;
const CARD_HEIGHT = 480;
const CAPTURE_WIDTH = CARD_WIDTH * 2;
const CAPTURE_HEIGHT = CARD_HEIGHT * 2;

const imageLoadCache = new Map<string, Promise<void>>();

function trimDateSeed(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "1970-01-01";
  }

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function getShareCardDateSeed(card: GrowthShareCard): string {
  if (card.kind === "daily_signin_completed" && card.daily_signin_payload) {
    return trimDateSeed(card.daily_signin_payload.stat_date);
  }

  return trimDateSeed(card.triggered_at);
}

export function getShareCardBackgroundSrc(card: GrowthShareCard): string {
  const dateSeed = getShareCardDateSeed(card);
  const seedPrefix =
    card.kind === "daily_signin_completed"
      ? "parlasoul-signin"
      : "parlasoul-milestone";

  return `https://picsum.photos/seed/${seedPrefix}-${dateSeed}/${CAPTURE_WIDTH}/${CAPTURE_HEIGHT}`;
}

export function getShareCardAssetUrls(
  card: GrowthShareCard,
  userAvatar: string | null,
): string[] {
  const urls = [resolveShareCardImageSrc(getShareCardBackgroundSrc(card))];

  if (
    card.kind === "character_message_milestone" &&
    card.character_milestone_payload
  ) {
    if (userAvatar) {
      urls.push(resolveShareCardImageSrc(userAvatar));
    }

    urls.push(
      resolveShareCardImageSrc(
        resolveCharacterAvatarSrc(card.character_milestone_payload),
      ),
    );
  }

  return Array.from(new Set(urls.filter(Boolean)));
}

function isRemoteHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

export function resolveShareCardImageSrc(src: string): string {
  if (!isRemoteHttpUrl(src)) {
    return src;
  }

  return `/api/share-card-image?src=${encodeURIComponent(src)}`;
}

function preloadImage(src: string): Promise<void> {
  const cached = imageLoadCache.get(src);
  if (cached) {
    return cached;
  }

  const task = new Promise<void>((resolve) => {
    const image = new Image();

    image.crossOrigin = "anonymous";
    image.referrerPolicy = "no-referrer";

    const finish = () => {
      image.onload = null;
      image.onerror = null;
      resolve();
    };

    image.onload = finish;
    image.onerror = () => {
      image.onload = null;
      image.onerror = null;
      imageLoadCache.delete(src);
      resolve();
    };
    image.src = src;

    if (image.complete) {
      finish();
    }
  });

  imageLoadCache.set(src, task);
  return task;
}

export async function preloadShareCardAssets(urls: string[]): Promise<void> {
  await Promise.all(urls.map((src) => preloadImage(src)));
}
