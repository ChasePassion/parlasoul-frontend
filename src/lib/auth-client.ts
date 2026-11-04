"use client";

import { dodopaymentsClient } from "@dodopayments/better-auth";
import { createAuthClient } from "better-auth/react";
import { emailOTPClient, jwtClient } from "better-auth/client/plugins";

const runtimeFetch: typeof fetch = (input, init) => globalThis.fetch(input, init);

export const authClient = createAuthClient({
  plugins: [emailOTPClient(), jwtClient(), dodopaymentsClient()],
  fetchOptions: {
    customFetchImpl: runtimeFetch,
  },
  sessionOptions: {
    refetchOnWindowFocus: false,
  },
});
