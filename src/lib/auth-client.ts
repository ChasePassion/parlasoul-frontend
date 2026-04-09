"use client";

import { dodopaymentsClient } from "@dodopayments/better-auth";
import { createAuthClient } from "better-auth/react";
import { emailOTPClient, jwtClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  plugins: [emailOTPClient(), jwtClient(), dodopaymentsClient()],
});
