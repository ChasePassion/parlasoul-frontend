import { getRedisClient } from "@/lib/redis";

const DEFAULT_DELIVERY_KEY_PREFIX = "parlasoul:email-otp:delivery";
const DEFAULT_DELIVERY_TTL_SECONDS = 300;

export type EmailOtpDeliveryState = "pending" | "sent" | "failed";

export interface EmailOtpDeliveryRecord {
  status: EmailOtpDeliveryState;
  message?: string;
  at: number;
}

function getDeliveryKeyPrefix(): string {
  return (
    process.env.OTP_DELIVERY_STATUS_KEY_PREFIX?.trim() ||
    DEFAULT_DELIVERY_KEY_PREFIX
  );
}

function getDeliveryTtlSeconds(): number {
  const ttl = Number(process.env.OTP_DELIVERY_STATUS_TTL_SECONDS);
  return Number.isFinite(ttl) && ttl > 0
    ? Math.floor(ttl)
    : DEFAULT_DELIVERY_TTL_SECONDS;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function buildDeliveryKey(email: string): string {
  return `${getDeliveryKeyPrefix()}:${normalizeEmail(email)}`;
}

function isDeliveryState(value: unknown): value is EmailOtpDeliveryState {
  return value === "pending" || value === "sent" || value === "failed";
}

export async function setEmailOtpDeliveryRecord(
  email: string,
  record: EmailOtpDeliveryRecord,
): Promise<void> {
  try {
    const redis = await getRedisClient();
    await redis.set(buildDeliveryKey(email), JSON.stringify(record), {
      EX: getDeliveryTtlSeconds(),
    });
  } catch (error) {
    console.error("Failed to persist email OTP delivery status:", error);
  }
}

export async function getEmailOtpDeliveryRecord(
  email: string,
): Promise<EmailOtpDeliveryRecord | null> {
  try {
    const redis = await getRedisClient();
    const raw = await redis.get(buildDeliveryKey(email));
    if (!raw) {
      return null;
    }

    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) {
      return null;
    }

    const record = parsed as Partial<EmailOtpDeliveryRecord>;
    if (!isDeliveryState(record.status) || typeof record.at !== "number") {
      return null;
    }

    return {
      status: record.status,
      message: typeof record.message === "string" ? record.message : undefined,
      at: record.at,
    };
  } catch (error) {
    console.error("Failed to read email OTP delivery status:", error);
    return null;
  }
}
