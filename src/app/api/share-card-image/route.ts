import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getRedisClient } from "@/lib/redis";

export const runtime = "nodejs";

const CACHE_KEY_PREFIX = "parlasoul:share-card:image";
const CACHE_TTL_SECONDS = 60 * 60 * 24 * 7;

type CachedShareCardImage = {
  contentType: string;
  bodyBase64: string;
};

function buildCacheKey(sourceUrl: string): string {
  const digest = createHash("sha256").update(sourceUrl).digest("hex");
  return `${CACHE_KEY_PREFIX}:${digest}`;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
}

function decodeCachedBody(payload: CachedShareCardImage): ArrayBuffer {
  return toArrayBuffer(Buffer.from(payload.bodyBase64, "base64"));
}

function encodeBodyBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

const ALLOWED_IMAGE_HOSTS = new Set(["picsum.photos"]);

function isPrivateHostname(hostname: string): boolean {
  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]"
  ) {
    return true;
  }

  const match = hostname.match(
    /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/,
  );
  if (match) {
    const a = Number(match[1]);
    const b = Number(match[2]);
    if (a === 10) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true;
    if (a === 127) return true;
  }

  return false;
}

function isAllowedRemoteSource(sourceUrl: string): boolean {
  try {
    const url = new URL(sourceUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    if (isPrivateHostname(url.hostname)) return false;
    return ALLOWED_IMAGE_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  const sourceUrl = request.nextUrl.searchParams.get("src")?.trim();

  if (!sourceUrl || !isAllowedRemoteSource(sourceUrl)) {
    return NextResponse.json(
      { error: "Invalid share card image source." },
      { status: 400 },
    );
  }

  const cacheKey = buildCacheKey(sourceUrl);
  const redis = await getRedisClient();
  const cachedPayload = await redis.get(cacheKey);

  if (cachedPayload) {
    try {
      const parsed = JSON.parse(cachedPayload) as CachedShareCardImage;
      return new NextResponse(decodeCachedBody(parsed), {
        status: 200,
        headers: {
          "Content-Type": parsed.contentType,
          "Cache-Control": `public, max-age=${CACHE_TTL_SECONDS}, immutable`,
          "X-Share-Card-Cache": "redis-hit",
        },
      });
    } catch (error) {
      console.error("Failed to parse cached share card image:", error);
      await redis.del(cacheKey);
    }
  }

  const upstreamResponse = await fetch(sourceUrl, {
    cache: "no-store",
    headers: {
      Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
    },
  });

  if (!upstreamResponse.ok) {
    return NextResponse.json(
      { error: "Failed to fetch share card image." },
      { status: upstreamResponse.status },
    );
  }

  const arrayBuffer = await upstreamResponse.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  const contentType =
    upstreamResponse.headers.get("content-type")?.split(";")[0]?.trim() ||
    "application/octet-stream";

  const cachePayload: CachedShareCardImage = {
    contentType,
    bodyBase64: encodeBodyBase64(bytes),
  };

  await redis.set(cacheKey, JSON.stringify(cachePayload), {
    EX: CACHE_TTL_SECONDS,
  });

  return new NextResponse(toArrayBuffer(bytes), {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": `public, max-age=${CACHE_TTL_SECONDS}, immutable`,
      "X-Share-Card-Cache": "redis-miss",
    },
  });
}
