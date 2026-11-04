import type { UserEntitlementTier } from "./api-service";

const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);

function readBooleanFlag(value: string | undefined, defaultValue: boolean) {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) {
    return defaultValue;
  }
  return TRUE_VALUES.has(normalized);
}

export function isBillingPaywallEnabled() {
  const serverValue = process.env.BILLING_PAYWALL_ENABLED;
  const publicValue = process.env.NEXT_PUBLIC_BILLING_PAYWALL_ENABLED;

  return readBooleanFlag(
    typeof window === "undefined" ? serverValue ?? publicValue : publicValue,
    false,
  );
}

export function isBillingPaywallDisabled() {
  return !isBillingPaywallEnabled();
}

export function isBillingCheckoutEnabled() {
  const serverValue = process.env.BILLING_CHECKOUT_ENABLED;
  const publicValue = process.env.NEXT_PUBLIC_BILLING_CHECKOUT_ENABLED;

  return readBooleanFlag(
    typeof window === "undefined" ? serverValue ?? publicValue : publicValue,
    false,
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
