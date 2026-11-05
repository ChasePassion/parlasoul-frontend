import { NextRequest, NextResponse } from "next/server";

import { getEmailOtpDeliveryRecord } from "@/lib/auth-email-otp-delivery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET(request: NextRequest) {
  const email = request.nextUrl.searchParams.get("email")?.trim() ?? "";

  if (!EMAIL_PATTERN.test(email)) {
    return NextResponse.json(
      { error: "Invalid email address." },
      { status: 400 },
    );
  }

  const record = await getEmailOtpDeliveryRecord(email);

  if (!record) {
    return NextResponse.json({ status: "unknown" });
  }

  return NextResponse.json({
    status: record.status,
    message: record.message ?? null,
    at: record.at,
  });
}
