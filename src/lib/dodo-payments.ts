import "server-only";

import DodoPayments from "dodopayments";
import type { Product, Price } from "dodopayments/resources/products/products";

import {
  type BillingTier,
  DODO_CHECKOUT_PRODUCTS,
  PRICING_PLAN_DEFINITIONS,
  formatMinorCurrency,
  type PricingCatalogPlan,
} from "./billing-plans";

type DodoEnvironment = "test_mode" | "live_mode";

let dodoPaymentsClient: DodoPayments | null = null;
let pricingCatalogCache:
  | {
      expiresAt: number;
      plans: PricingCatalogPlan[];
    }
  | null = null;

const PRICING_CATALOG_CACHE_TTL_MS = 60_000;
const PRODUCT_RETRIEVE_RETRY_LIMIT = 2;

function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing ${name} for Dodo Payments.`);
  }
  return value;
}

export function getDodoPaymentsEnvironment(): DodoEnvironment {
  const environment = requireEnv("DODO_PAYMENTS_ENVIRONMENT");
  if (environment !== "test_mode" && environment !== "live_mode") {
    throw new Error("DODO_PAYMENTS_ENVIRONMENT must be test_mode or live_mode.");
  }

  return environment;
}

export function getDodoPaymentsWebhookSecret() {
  return requireEnv("DODO_PAYMENTS_WEBHOOK_SECRET");
}

export function getDodoPaymentsClient() {
  if (dodoPaymentsClient) {
    return dodoPaymentsClient;
  }

  dodoPaymentsClient = new DodoPayments({
    bearerToken: requireEnv("DODO_PAYMENTS_API_KEY"),
    environment: getDodoPaymentsEnvironment(),
  });

  return dodoPaymentsClient;
}

function isTimeoutError(error: unknown) {
  return error instanceof Error && error.message.includes("Request timed out");
}

async function retrieveProductWithRetry(
  client: DodoPayments,
  productId: string,
  attempts = PRODUCT_RETRIEVE_RETRY_LIMIT,
) {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await client.products.retrieve(productId);
    } catch (error) {
      lastError = error;

      if (!isTimeoutError(error) || attempt === attempts) {
        throw error;
      }

      await new Promise((resolve) => setTimeout(resolve, attempt * 250));
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Unknown Dodo product retrieval error");
}

function requireRecurringPrice(product: Product, productId: string) {
  const { price } = product;
  if (price.type !== "recurring_price") {
    throw new Error(`Dodo product ${productId} is not a recurring price product.`);
  }

  return price;
}

function formatBillingIntervalLabel(price: Price.RecurringPrice) {
  const intervalLabel =
    price.payment_frequency_interval === "Year"
      ? "年"
      : price.payment_frequency_interval === "Month"
        ? "月"
        : price.payment_frequency_interval === "Week"
          ? "周"
          : "日";

  return price.payment_frequency_count === 1
    ? `每${intervalLabel}`
    : `每 ${price.payment_frequency_count} ${intervalLabel}`;
}

function getPlanBillingIntervalLabel(
  definition: (typeof PRICING_PLAN_DEFINITIONS)[number],
  price: Price.RecurringPrice,
) {
  if (definition.period === "yearly") {
    return "每年";
  }

  if (definition.period === "monthly") {
    return "每月";
  }

  return formatBillingIntervalLabel(price);
}

function mapProductToCatalogPlan(product: Product): PricingCatalogPlan {
  const definition = PRICING_PLAN_DEFINITIONS.find((item) => item.productId === product.product_id);
  if (!definition) {
    throw new Error(`Unknown Dodo product mapping for ${product.product_id}.`);
  }

  const price = requireRecurringPrice(product, product.product_id);

  return {
    ...definition,
    productName: product.name?.trim() || `${definition.tierLabel} ${definition.period}`,
    currency: price.currency,
    priceMinor: price.price,
    priceDisplay: formatMinorCurrency(price.price, price.currency),
    billingIntervalLabel: getPlanBillingIntervalLabel(definition, price),
    trialPeriodDays: price.trial_period_days ?? null,
  };
}

function buildYearlySavingsLabel(
  tier: BillingTier,
  yearlyPriceMinor: number,
  monthlyPriceMinorByTier: Map<BillingTier, number>,
) {
  const monthlyPriceMinor = monthlyPriceMinorByTier.get(tier);
  if (!monthlyPriceMinor) {
    return undefined;
  }

  const monthlyTwelvePrice = monthlyPriceMinor * 12;
  if (monthlyTwelvePrice <= yearlyPriceMinor) {
    return undefined;
  }

  const savedRatio = 1 - yearlyPriceMinor / monthlyTwelvePrice;
  const savedPercent = Math.round(savedRatio * 100);
  return savedPercent > 0 ? `比月付节省 ${savedPercent}%` : undefined;
}

export async function getPricingCatalog() {
  const cachedCatalog =
    pricingCatalogCache && pricingCatalogCache.expiresAt > Date.now()
      ? pricingCatalogCache.plans
      : null;
  if (cachedCatalog) {
    return cachedCatalog;
  }

  const client = getDodoPaymentsClient();

  const products: Product[] = [];
  for (const { productId } of DODO_CHECKOUT_PRODUCTS) {
    products.push(await retrieveProductWithRetry(client, productId));
  }

  const catalogPlans = products.map(mapProductToCatalogPlan);
  const monthlyPriceMinorByTier = new Map<BillingTier, number>();

  for (const plan of catalogPlans) {
    if (plan.period === "monthly") {
      monthlyPriceMinorByTier.set(plan.tier, plan.priceMinor);
    }
  }

  const plans = catalogPlans.map((plan) =>
    plan.period === "yearly"
      ? {
          ...plan,
          yearlySavingsLabel: buildYearlySavingsLabel(
            plan.tier,
            plan.priceMinor,
            monthlyPriceMinorByTier,
          ),
        }
      : plan,
  );

  pricingCatalogCache = {
    expiresAt: Date.now() + PRICING_CATALOG_CACHE_TTL_MS,
    plans,
  };

  return plans;
}
