import { logger, Module, AuthEvent } from "@/lib/logger";

function maskEmail(email: string): string {
  const [localPart = "", domain = "unknown"] = email.split("@");
  const firstChar = localPart.slice(0, 1) || "*";
  return `${firstChar}***@${domain}`;
}

export async function logEmailOtpEvent(params: {
  event: "email_otp.delivery_queued" | "email_otp.delivery_sent" | "email_otp.delivery_failed";
  message: string;
  email: string;
  otpType: string;
  durationMs?: number;
  errorMessage?: string | null;
}) {
  const { event, message, email, otpType, durationMs, errorMessage } = params;
  const email_hint = maskEmail(email);

  if (event === "email_otp.delivery_queued") {
    logger.info(Module.AUTH, AuthEvent.EMAIL_OTP_DELIVERY_QUEUED, message, {
      email_hint,
      otp_type: otpType,
    });
  } else if (event === "email_otp.delivery_sent") {
    logger.info(Module.AUTH, AuthEvent.EMAIL_OTP_DELIVERY_SENT, message, {
      email_hint,
      otp_type: otpType,
      duration_ms: durationMs,
    });
  } else {
    logger.error(Module.AUTH, AuthEvent.EMAIL_OTP_DELIVERY_FAILED, message, {
      email_hint,
      otp_type: otpType,
      duration_ms: durationMs,
      error_message: errorMessage ?? undefined,
    });
  }
}
