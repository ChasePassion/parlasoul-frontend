import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { emailOTP, jwt } from "better-auth/plugins";
import {
  checkout,
  dodopayments,
  portal,
  webhooks,
} from "@dodopayments/better-auth";
import nodemailer from "nodemailer";
import { Pool } from "pg";

import { logEmailOtpEvent } from "./auth-email-otp-log";
import { DODO_CHECKOUT_PRODUCTS } from "./billing-plans";
import {
  getDodoPaymentsClient,
  getDodoPaymentsWebhookSecret,
} from "./dodo-payments";

let emailTransporter: nodemailer.Transporter | null = null;
let pool: Pool | null = null;
let authInstance: ReturnType<typeof createAuth> | null = null;

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing ${name} for Better Auth.`);
  }
  return value;
}

function getDatabaseUrl() {
  return requireEnv("DATABASE_URL");
}

function getBetterAuthUrl() {
  return requireEnv("BETTER_AUTH_URL");
}

function getBetterAuthSecret() {
  return requireEnv("BETTER_AUTH_SECRET");
}

function buildTrustedOrigins() {
  const origins = new Set<string>();

  const addOrigin = (value: string | undefined) => {
    const normalized = value?.trim();
    if (!normalized) {
      return;
    }

    const origin = new URL(normalized).origin;
    origins.add(origin);

    const variantUrl = new URL(origin);
    if (variantUrl.hostname === "localhost") {
      variantUrl.hostname = "127.0.0.1";
      origins.add(variantUrl.origin);
    } else if (variantUrl.hostname === "127.0.0.1") {
      variantUrl.hostname = "localhost";
      origins.add(variantUrl.origin);
    }
  };

  addOrigin(getBetterAuthUrl());
  addOrigin(process.env.NEXT_PUBLIC_SITE_URL);

  return Array.from(origins);
}

function getPool() {
  if (pool) {
    return pool;
  }

  pool = new Pool({
    connectionString: getDatabaseUrl(),
  });

  return pool;
}

function getPurelymailConfig() {
  const host = process.env.PURELYMAIL_SMTP_HOST?.trim() || "smtp.purelymail.com";
  const port = Number(process.env.PURELYMAIL_SMTP_PORT || "465");
  const user = process.env.PURELYMAIL_SMTP_USER?.trim();
  const password = process.env.PURELYMAIL_SMTP_PASSWORD?.trim();
  const from = process.env.PURELYMAIL_FROM_EMAIL?.trim();

  if (!user) {
    throw new Error("Missing PURELYMAIL_SMTP_USER for Better Auth email OTP.");
  }

  if (!password) {
    throw new Error("Missing PURELYMAIL_SMTP_PASSWORD for Better Auth email OTP.");
  }

  if (!from) {
    throw new Error("Missing PURELYMAIL_FROM_EMAIL for Better Auth email OTP.");
  }

  return {
    host,
    port,
    secure: port === 465,
    user,
    password,
    from,
  };
}

function getPurelymailTransporter() {
  if (emailTransporter) {
    return emailTransporter;
  }

  const config = getPurelymailConfig();

  emailTransporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    pool: true,
    maxConnections: 3,
    maxMessages: 100,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 10_000,
    auth: {
      user: config.user,
      pass: config.password,
    },
  });

  return emailTransporter;
}

function normalizeDeliveryError(error: unknown): string {
  if (!(error instanceof Error)) {
    return "邮件发送失败，请稍后重试";
  }

  const message = error.message.trim();
  return message || "邮件发送失败，请稍后重试";
}

function queueEmailOtpDelivery(params: {
  email: string;
  otpType: string;
  subject: string;
  html: string;
}) {
  const { email, otpType, subject, html } = params;
  const config = getPurelymailConfig();
  const transporter = getPurelymailTransporter();
  const startedAt = Date.now();

  void logEmailOtpEvent({
    event: "email_otp.delivery_queued",
    message: "OTP email queued for background delivery",
    email,
    otpType,
  });

  setTimeout(() => {
    void (async () => {
      try {
        await transporter.sendMail({
          from: config.from,
          to: email,
          subject,
          html,
        });

        await logEmailOtpEvent({
          event: "email_otp.delivery_sent",
          message: "OTP email delivered to SMTP provider",
          email,
          otpType,
          durationMs: Date.now() - startedAt,
        });
      } catch (error) {
        const normalizedError = normalizeDeliveryError(error);
        console.error("Failed to deliver OTP email:", normalizedError);
        await logEmailOtpEvent({
          event: "email_otp.delivery_failed",
          message: "OTP email delivery failed",
          email,
          otpType,
          durationMs: Date.now() - startedAt,
          errorMessage: normalizedError,
        });
      }
    })();
  }, 0);
}

function buildGoogleProvider() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return undefined;
  }

  return {
    google: {
      clientId,
      clientSecret,
    },
  };
}

function createAuth() {
  const betterAuthUrl = getBetterAuthUrl();
  const betterAuthSecret = getBetterAuthSecret();
  const trustedOrigins = buildTrustedOrigins();
  const resolvedPool = getPool();

  return betterAuth({
    appName: "parlasoul",
    database: resolvedPool,
    baseURL: betterAuthUrl,
    trustedOrigins,
    secret: betterAuthSecret,
    user: {
      modelName: "users",
      fields: {
        name: "display_name",
        image: "avatar_url",
        emailVerified: "email_verified",
        createdAt: "created_at",
        updatedAt: "updated_at",
      },
      additionalFields: {
        username: {
          type: "string",
          required: false,
          input: false,
          fieldName: "username",
        },
        lastLoginAt: {
          type: "date",
          required: false,
          input: false,
          fieldName: "last_login_at",
        },
      },
    },
    advanced: {
      database: {
        generateId: "uuid",
      },
    },
    emailAndPassword: {
      enabled: false,
    },
    socialProviders: buildGoogleProvider(),
    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            const fallbackName =
              user.name?.trim() || user.email.split("@")[0] || "新用户";
            return {
              data: {
                ...user,
                name: fallbackName,
              },
            };
          },
        },
      },
      session: {
        create: {
          after: async (session) => {
            await resolvedPool.query(
              "UPDATE users SET last_login_at = NOW() WHERE id = $1",
              [session.userId],
            );
          },
        },
      },
    },
    plugins: [
      emailOTP({
        otpLength: 6,
        expiresIn: 300,
        async sendVerificationOTP({ email, otp, type }) {
          const normalizedEmail = email.trim().toLowerCase();
          getPurelymailConfig();
          getPurelymailTransporter();

          const subject =
            type === "email-verification"
              ? "ParlaSoul 邮箱验证验证码"
              : "ParlaSoul 登录验证码";

          const title =
            type === "email-verification"
              ? "邮箱验证验证码"
              : "登录验证码";

          const html = `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #111827; line-height: 1.6;">
              <h2 style="margin-bottom: 12px;">${title}</h2>
              <p>您好，您的验证码如下：</p>
              <div style="margin: 20px 0; font-size: 28px; font-weight: 700; letter-spacing: 8px;">${otp}</div>
              <p>验证码 5 分钟内有效，请勿泄露给他人。</p>
            </div>
          `;

          queueEmailOtpDelivery({
            email: normalizedEmail,
            otpType: type,
            subject,
            html,
          });
        },
      }),
      jwt(),
      dodopayments({
        client: getDodoPaymentsClient(),
        createCustomerOnSignUp: true,
        use: [
          checkout({
            products: DODO_CHECKOUT_PRODUCTS,
            successUrl: "/pricing?checkout=success",
            authenticatedUsersOnly: true,
          }),
          portal(),
          webhooks({
            webhookKey: getDodoPaymentsWebhookSecret(),
            onPayload: async (payload) => {
              console.log("Received Dodo Payments webhook:", payload.type);
            },
          }),
        ],
      }),
      nextCookies(),
    ],
  });
}

export function getAuth(): ReturnType<typeof createAuth> {
  if (authInstance) {
    return authInstance;
  }

  authInstance = createAuth();
  return authInstance;
}

export type AuthSession = ReturnType<typeof getAuth>["$Infer"]["Session"];
