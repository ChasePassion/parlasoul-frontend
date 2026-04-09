export type BillingPeriod = "monthly" | "yearly";
export type BillingTier = "plus" | "pro";

export interface PricingPlanDefinition {
  period: BillingPeriod;
  tier: BillingTier;
  slug: string;
  productId: string;
  tierLabel: string;
  summary: string;
  featurePoints: string[];
  accentLabel?: string;
}

export interface PricingCatalogPlan extends PricingPlanDefinition {
  productName: string;
  currency: string;
  priceMinor: number;
  priceDisplay: string;
  billingIntervalLabel: string;
  trialPeriodDays: number | null;
  yearlySavingsLabel?: string;
}

const ZERO_DECIMAL_CURRENCIES = new Set([
  "BIF",
  "CLP",
  "DJF",
  "GNF",
  "JPY",
  "KMF",
  "KRW",
  "MGA",
  "PYG",
  "RWF",
  "UGX",
  "VND",
  "VUV",
  "XAF",
  "XOF",
  "XPF",
]);

export const PRICING_PLAN_DEFINITIONS: PricingPlanDefinition[] = [
  {
    period: "monthly",
    tier: "plus",
    slug: "plus-monthly",
    productId: "pdt_0NcDp7r5grpEuNp1MpzAc",
    tierLabel: "Plus",
    summary: "适合稳定练习与日常使用。",
    featurePoints: ["月付订阅", "支持 Dodo 托管结算", "登录后可在账单页管理订阅"],
  },
  {
    period: "monthly",
    tier: "pro",
    slug: "pro-monthly",
    productId: "pdt_0NcDpO20F6OKTXZMie9VZ",
    tierLabel: "Pro",
    summary: "适合更高频率的长期使用。",
    featurePoints: ["月付订阅", "支持 Dodo 托管结算", "登录后可在账单页管理订阅"],
    accentLabel: "更高阶",
  },
  {
    period: "yearly",
    tier: "plus",
    slug: "plus-yearly",
    productId: "pdt_0NcDpGYMY6f8Pwma4W6g0",
    tierLabel: "Plus",
    summary: "适合长期连续学习，年度结算更省心。",
    featurePoints: ["年付订阅", "支持 Dodo 托管结算", "登录后可在账单页管理订阅"],
    accentLabel: "年度方案",
  },
  {
    period: "yearly",
    tier: "pro",
    slug: "pro-yearly",
    productId: "pdt_0NcDpUXR7H18wHvMwEBRr",
    tierLabel: "Pro",
    summary: "适合长期高频投入，按年结算。",
    featurePoints: ["年付订阅", "支持 Dodo 托管结算", "登录后可在账单页管理订阅"],
    accentLabel: "年度方案",
  },
];

export const DODO_CHECKOUT_PRODUCTS = PRICING_PLAN_DEFINITIONS.map((plan) => ({
  productId: plan.productId,
  slug: plan.slug,
}));

export function getBillingPeriodFromValue(value: string | null | undefined): BillingPeriod {
  return value === "yearly" ? "yearly" : "monthly";
}

export function isPricingPlanSlug(value: string | null | undefined): value is string {
  if (!value) {
    return false;
  }

  return PRICING_PLAN_DEFINITIONS.some((plan) => plan.slug === value);
}

export function getPricingPlanBySlug(slug: string) {
  return PRICING_PLAN_DEFINITIONS.find((plan) => plan.slug === slug) ?? null;
}

export function getPricingPlansForPeriod(period: BillingPeriod) {
  return PRICING_PLAN_DEFINITIONS.filter((plan) => plan.period === period);
}

export function buildPricingPath(params?: {
  period?: BillingPeriod;
  checkout?: string | null;
}) {
  const period = params?.period ?? "monthly";
  const searchParams = new URLSearchParams();
  searchParams.set("period", period);

  if (params?.checkout) {
    searchParams.set("checkout", params.checkout);
  }

  return `/pricing?${searchParams.toString()}`;
}

export function isSetupBypassPath(pathname: string) {
  return pathname.startsWith("/pricing") || pathname.startsWith("/billing");
}

export function formatMinorCurrency(amountMinor: number, currency: string) {
  const divisor = ZERO_DECIMAL_CURRENCIES.has(currency.toUpperCase()) ? 1 : 100;
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: currency.toUpperCase(),
    maximumFractionDigits: divisor === 1 ? 0 : 2,
  }).format(amountMinor / divisor);
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "暂未提供";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}
