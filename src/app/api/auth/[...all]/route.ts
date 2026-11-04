import { getAuth } from "@/lib/auth";
import { isBillingCheckoutDisabled } from "@/lib/billing-flags";
import { toNextJsHandler } from "better-auth/next-js";

const disabledDodoPaymentPaths = [
  "/api/auth/dodopayments/checkout",
  "/api/auth/dodopayments/checkout-session",
  "/api/auth/dodopayments/customer/portal",
  "/api/auth/dodopayments/customer/subscriptions/list",
  "/api/auth/dodopayments/customer/payments/list",
];

function isDisabledDodoPaymentRequest(request: Request) {
  const { pathname } = new URL(request.url);
  return disabledDodoPaymentPaths.some((path) => pathname === path);
}

const authHandler = toNextJsHandler(async (request: Request) => {
  if (isBillingCheckoutDisabled() && isDisabledDodoPaymentRequest(request)) {
    return Response.json(
      { message: "试跑期暂未开放支付" },
      { status: 409 },
    );
  }

  return await getAuth().handler(request);
});

export const { GET, POST, PATCH, PUT, DELETE } = authHandler;
