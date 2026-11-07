import type { UserEntitlementTier } from "./api-service";

const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);

function readBooleanFlag(value: string | undefined, defaultValue: boolean) {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) {
    return defaultValue;
  }
  return TRUE_VALUES.has(normalized);
}

// Accepts already-read env values: Next.js only inlines NEXT_PUBLIC_* at build
// time for static member access, so the reads must stay at the call sites.
function readBillingEnvFlag(
  serverValue: string | undefined,
  publicValue: string | undefined,
) {
  return readBooleanFlag(
    typeof window === "undefined" ? serverValue ?? publicValue : publicValue,
    false,
  );
}

export function isBillingPaywallEnabled() {
  return readBillingEnvFlag(
    process.env.BILLING_PAYWALL_ENABLED,
    process.env.NEXT_PUBLIC_BILLING_PAYWALL_ENABLED,
  );
}

export function isBillingPaywallDisabled() {
  return !isBillingPaywallEnabled();
}

export function isBillingCheckoutEnabled() {
  return readBillingEnvFlag(
    process.env.BILLING_CHECKOUT_ENABLED,
    process.env.NEXT_PUBLIC_BILLING_CHECKOUT_ENABLED,
  );
}

export function isBillingCheckoutDisabled() {
  return !isBillingCheckoutEnabled();
}

export function getBillingGateTier(
  tier: UserEntitlementTier | null | undefined,
): UserEntitlementTier {
  return isBillingPaywallDisabled() ? "pro" : tier ?? "free";
}
