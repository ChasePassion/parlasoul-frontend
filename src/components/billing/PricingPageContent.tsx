"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Check,
  ChevronDown,
  Loader2,
  Settings,
} from "lucide-react";

import { useAuth } from "@/lib/auth-context";
import {
  createDodoCheckoutSession,
  createDodoCustomerPortal,
  createWechatCheckoutSession,
  getWechatPaymentOrder,
  getWechatPaymentProducts,
} from "@/lib/api";
import type { WechatPaymentProduct } from "@/lib/api-service";
import {
  buildPricingPath,
  getBillingPeriodFromValue,
  getBillingTierRank,
  getPricingModeFromValue,
  getPricingPlanBySlug,
  getPricingPlansForPeriod,
  type BillingPeriod,
  type PricingCatalogPlan,
} from "@/lib/billing-plans";
import { getErrorMessage } from "@/lib/error-map";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface PricingPageContentProps {
  catalog: PricingCatalogPlan[];
}

const FREE_FEATURES = [
  "基础对话功能",
  "每日有限额度",
  "无音色克隆",
  "无记忆功能",
];

const PLUS_FEATURES = {
  subscription: [
    "按月自动续费，随时可取消",
    "支持海外信用卡安全结算",
    "音色克隆与记忆功能全面解锁",
  ],
  wechat: [
    "一次性开通，即时生效",
    "微信安全支付",
    "音色克隆与记忆功能全面解锁",
  ],
};

const PRO_FEATURES = {
  subscription: [
    "包含 Plus 所有权益",
    "更高频次的语音生成额度",
    "优先体验实验性新功能",
  ],
  wechat: [
    "包含 Plus 所有权益",
    "更高频次的语音生成额度",
    "优先体验实验性新功能",
  ],
};

function getPlansForDisplay(catalog: PricingCatalogPlan[], period: BillingPeriod) {
  const planOrder = getPricingPlansForPeriod(period).map((plan) => plan.slug);
  return catalog
    .filter((plan) => plan.period === period)
    .sort((left, right) => planOrder.indexOf(left.slug) - planOrder.indexOf(right.slug));
}

function isTierBlocked(
  currentTier: "free" | "plus" | "pro" | null | undefined,
  targetTier: "plus" | "pro",
) {
  return (
    getBillingTierRank(currentTier) > 0 &&
    getBillingTierRank(targetTier) <= getBillingTierRank(currentTier)
  );
}

function getTierBlockMessage(
  currentTier: "free" | "plus" | "pro" | null | undefined,
  targetTier: "plus" | "pro",
) {
  if (!isTierBlocked(currentTier, targetTier)) return null;
  if (currentTier === targetTier) return `你已拥有有效的 ${targetTier === "plus" ? "Plus" : "Pro"} 权益`;
  return "你已拥有更高阶的有效权益，无需重复购买当前档位";
}

function formatDurationLabel(durationDays: number) {
  return durationDays >= 365 ? "365 天" : `${durationDays} 天`;
}

export default function PricingPageContent({ catalog }: PricingPageContentProps) {
  const { user, entitlements, refreshEntitlements, isLoading, isEntitlementsLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [checkoutError, setCheckoutError] = useState("");
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [wechatProducts, setWechatProducts] = useState<WechatPaymentProduct[]>([]);
  const [isWechatProductsLoading, setIsWechatProductsLoading] = useState(true);
  const [isPortalLoading, setIsPortalLoading] = useState(false);
  const [checkoutBanner, setCheckoutBanner] = useState<{
    type: "success" | "pending" | "failed" | "loading";
    message: string;
  } | null>(null);
  const handledAutoCheckoutRef = useRef<Set<string>>(new Set());

  const checkoutStatus = searchParams.get("checkout");
  const checkoutChannel = searchParams.get("channel");
  const checkoutOrderId = searchParams.get("order_id");

  const selectedPeriod = getBillingPeriodFromValue(searchParams.get("period"));
  const selectedMode = getPricingModeFromValue(searchParams.get("mode"));
  const checkoutSlug = searchParams.get("checkout");
  const pendingWechatProductId = searchParams.get("product_id");
  const visiblePlans = getPlansForDisplay(catalog, selectedPeriod);
  const currentTier = entitlements?.tier ?? "free";
  const busyWithEntitlements = Boolean(user) && isEntitlementsLoading;
  const hasActiveSubscription = currentTier === "plus" || currentTier === "pro";

  const plusPlan = visiblePlans.find((p) => p.tier === "plus");
  const proPlan = visiblePlans.find((p) => p.tier === "pro");

  const plusWechatProducts = wechatProducts.filter((p) => p.tier === "plus");
  const proWechatProducts = wechatProducts.filter((p) => p.tier === "pro");

  /* ── callbacks ── */

  const beginSubscriptionCheckout = useCallback(async (slug: string) => {
    setCheckoutError("");
    setPendingKey(`subscription:${slug}`);
    try {
      const session = await createDodoCheckoutSession({
        slug,
        referenceId: `pricing:${slug}:${Date.now()}`,
      });
      window.location.assign(session.url);
    } catch (error) {
      setCheckoutError(getErrorMessage(error));
    } finally {
      setPendingKey(null);
    }
  }, []);

  const beginWechatCheckout = useCallback(async (productId: string) => {
    setCheckoutError("");
    setPendingKey(`wechat:${productId}`);
    try {
      const session = await createWechatCheckoutSession({ product_id: productId });
      window.location.assign(session.checkout_url);
    } catch (error) {
      setCheckoutError(getErrorMessage(error));
    } finally {
      setPendingKey(null);
    }
  }, []);

  async function handleManageSubscription() {
    setIsPortalLoading(true);
    setCheckoutError("");
    try {
      const portal = await createDodoCustomerPortal();
      window.location.assign(portal.url);
    } catch (err) {
      setCheckoutError(getErrorMessage(err));
    } finally {
      setIsPortalLoading(false);
    }
  }

  /* ── effects ── */

  useEffect(() => {
    let cancelled = false;
    setIsWechatProductsLoading(true);
    void getWechatPaymentProducts()
      .then((res) => {
        if (!cancelled) setWechatProducts(res.items);
      })
      .catch((err) => {
        if (!cancelled) setCheckoutError(getErrorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setIsWechatProductsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /* ── checkout callback: sync status + refresh entitlements ── */

  useEffect(() => {
    if (checkoutStatus !== "success" || !user) return;

    let cancelled = false;

    async function processCheckout() {
      if (cancelled) return;
      setCheckoutBanner({ type: "loading", message: "正在同步支付结果，请稍候…" });

      try {
        if (checkoutChannel === "wechat" && checkoutOrderId) {
          const order = await getWechatPaymentOrder(checkoutOrderId);
          if (cancelled) return;

          if (order.status === "succeeded") {
            setCheckoutBanner({ type: "success", message: "微信支付已完成，权益已刷新。" });
          } else if (order.status === "created" || order.status === "checkout_created" || order.status === "pending") {
            setCheckoutBanner({ type: "pending", message: "订单已创建，正在等待支付最终确认。" });
          } else {
            setCheckoutBanner({ type: "failed", message: "微信支付未完成，请确认后重试。" });
          }
        } else {
          // recurring checkout — refresh entitlements and infer status
          const prevTier = entitlements?.tier ?? "free";
          try {
            await refreshEntitlements();
          } catch { /* best-effort */ }
          if (cancelled) return;

          // After refresh, if entitlements are still loading we just show a generic success
          setCheckoutBanner({ type: "success", message: "订阅支付已完成，权益已同步。" });
          void prevTier; // used above for comparison if needed
        }
      } catch {
        if (!cancelled) {
          setCheckoutBanner({ type: "failed", message: "同步支付结果失败，请刷新页面重试。" });
        }
      }
    }

    void processCheckout();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkoutStatus, checkoutChannel, checkoutOrderId, user]);

  useEffect(() => {
    if (!user || !checkoutSlug) return;
    const plan = getPricingPlanBySlug(checkoutSlug);
    if (!plan || handledAutoCheckoutRef.current.has(`subscription:${plan.slug}`)) return;
    handledAutoCheckoutRef.current.add(`subscription:${plan.slug}`);
    void beginSubscriptionCheckout(plan.slug);
  }, [beginSubscriptionCheckout, checkoutSlug, user]);

  useEffect(() => {
    if (!user || selectedMode !== "wechat" || !pendingWechatProductId) return;
    const key = `wechat:${pendingWechatProductId}`;
    if (handledAutoCheckoutRef.current.has(key)) return;
    handledAutoCheckoutRef.current.add(key);
    void beginWechatCheckout(pendingWechatProductId);
  }, [beginWechatCheckout, pendingWechatProductId, selectedMode, user]);

  /* ── handlers ── */

  function handlePeriodChange(period: BillingPeriod) {
    router.replace(buildPricingPath({ period, mode: selectedMode }));
  }

  function handleModeChange(mode: "subscription" | "wechat") {
    router.replace(buildPricingPath({ period: selectedPeriod, mode }));
  }

  function handleSubscriptionPurchase(slug: string) {
    const plan = getPricingPlanBySlug(slug);
    if (!plan) {
      setCheckoutError("当前套餐暂时不可购买，请稍后重试");
      return;
    }
    if (isTierBlocked(currentTier, plan.tier)) {
      setCheckoutError(getTierBlockMessage(currentTier, plan.tier) ?? "");
      return;
    }
    const nextPath = buildPricingPath({ period: plan.period, checkout: plan.slug });
    if (!user) {
      router.push(`/login?next=${encodeURIComponent(nextPath)}`);
      return;
    }
    void beginSubscriptionCheckout(plan.slug);
  }

  function handleWechatPurchase(productId: string, tier: "plus" | "pro") {
    if (isTierBlocked(currentTier, tier)) {
      setCheckoutError(getTierBlockMessage(currentTier, tier) ?? "");
      return;
    }
    const nextPath = buildPricingPath({ period: selectedPeriod, mode: "wechat", productId });
    if (!user) {
      router.push(`/login?next=${encodeURIComponent(nextPath)}`);
      return;
    }
    void beginWechatCheckout(productId);
  }

  /* ── render helpers ── */

  const activeFeatures = (tier: "plus" | "pro") =>
    selectedMode === "wechat"
      ? tier === "plus"
        ? PLUS_FEATURES.wechat
        : PRO_FEATURES.wechat
      : tier === "plus"
        ? PLUS_FEATURES.subscription
        : PRO_FEATURES.subscription;

  function renderPriceArea(
    plan: PricingCatalogPlan | undefined,
    wechatLoading: boolean,
    isWechat: boolean,
  ) {
    if (isWechat) {
      if (wechatLoading) return <div className="h-10 w-32 animate-pulse rounded bg-gray-200" />;
      return <span className="text-lg font-semibold text-gray-700">多种时长可选</span>;
    }
    if (!plan) return <span className="text-gray-400">暂不可用</span>;

    if (selectedPeriod === "monthly") {
      return (
        <div className="flex items-baseline gap-1">
          <span className="text-4xl font-bold tracking-tight">{plan.priceDisplay}</span>
        </div>
      );
    }
    return (
      <div className="flex flex-col">
        <div className="flex items-baseline gap-1">
          <span className="text-4xl font-bold tracking-tight">{plan.priceDisplay}</span>
        </div>
        {plan.yearlySavingsLabel && (
          <span className="mt-1 text-sm font-medium text-green-600">{plan.yearlySavingsLabel}</span>
        )}
      </div>
    );
  }

  function renderSubscriptionCta(
    plan: PricingCatalogPlan | undefined,
    tier: "plus" | "pro",
  ) {
    if (isTierBlocked(currentTier, tier)) {
      return (
        <button
          disabled
          className="w-full cursor-not-allowed rounded-lg border border-gray-200 bg-gray-100 px-4 py-3 text-sm font-medium text-gray-400"
        >
          {getTierBlockMessage(currentTier, tier) ?? "当前不可购买"}
        </button>
      );
    }
    const pending = plan ? pendingKey === `subscription:${plan.slug}` : false;
    return (
      <button
        onClick={() => plan && handleSubscriptionPurchase(plan.slug)}
        disabled={!plan || pending || isLoading || busyWithEntitlements}
        className="w-full rounded-lg bg-black px-4 py-3 font-medium text-white shadow-lg shadow-black/10 transition-colors hover:bg-gray-800 disabled:opacity-50"
      >
        {pending ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> 跳转中
          </span>
        ) : (
          `升级到 ${tier === "plus" ? "Plus" : "Pro"}`
        )}
      </button>
    );
  }

  function renderWechatCta(
    products: WechatPaymentProduct[],
    tier: "plus" | "pro",
  ) {
    if (isWechatProductsLoading) {
      return <div className="h-11 w-full animate-pulse rounded-lg bg-gray-200" />;
    }
    if (isTierBlocked(currentTier, tier)) {
      return (
        <button
          disabled
          className="w-full cursor-not-allowed rounded-lg border border-gray-200 bg-gray-100 px-4 py-3 text-sm font-medium text-gray-400"
        >
          {getTierBlockMessage(currentTier, tier) ?? "当前不可购买"}
        </button>
      );
    }
    if (products.length === 0) {
      return (
        <button
          disabled
          className="w-full cursor-not-allowed rounded-lg border border-gray-200 bg-gray-100 px-4 py-3 text-sm font-medium text-gray-400"
        >
          暂无产品
        </button>
      );
    }
    return (
      <div className="space-y-2">
        {products.map((product) => {
          const pending = pendingKey === `wechat:${product.product_id}`;
          return (
            <button
              key={product.product_id}
              onClick={() => handleWechatPurchase(product.product_id, tier)}
              disabled={pending || isLoading || busyWithEntitlements}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-black px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-black/10 transition-colors hover:bg-gray-800 disabled:opacity-50"
            >
              {pending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> 跳转中
                </>
              ) : (
                <>{formatDurationLabel(product.duration_days)} · 前往支付</>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  /* ── main render ── */

  return (
    <div className="min-h-screen bg-[#F9FAFB] pb-20 text-gray-900">
      <main className="mx-auto max-w-5xl px-6 pt-12">
        <section>
          {/* ── Header row ── */}
          <div className="mb-10 flex items-center justify-between">
            <div className="flex-1" />
            <h1 className="text-4xl font-bold tracking-tight">升级套餐</h1>
            <div className="flex flex-1 items-center justify-end gap-3">
              {/* 管理订阅 */}
              {hasActiveSubscription && (
                <button
                  onClick={() => void handleManageSubscription()}
                  disabled={isPortalLoading}
                  className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isPortalLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Settings className="h-4 w-4" />
                  )}
                  管理订阅
                </button>
              )}

              {/* 支付方式下拉 */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-gray-50">
                    <span>{selectedMode === "wechat" ? "微信支付" : "海外订阅"}</span>
                    <ChevronDown className="h-4 w-4 text-gray-500" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44 rounded-xl">
                  <DropdownMenuItem
                    onClick={() => handleModeChange("subscription")}
                    className="flex items-center justify-between"
                  >
                    <span>海外订阅</span>
                    {selectedMode !== "wechat" && <Check className="h-4 w-4" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleModeChange("wechat")}
                    className="flex items-center justify-between"
                  >
                    <span>微信支付</span>
                    {selectedMode === "wechat" && <Check className="h-4 w-4" />}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* ── Monthly / Yearly toggle ── */}
          {selectedMode !== "wechat" && (
            <div className="mb-10 flex justify-center">
              <div className="relative inline-flex items-center rounded-full bg-gray-100 p-1">
                {/* Sliding indicator */}
                <div
                  className={cn(
                    "absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-full bg-white shadow-sm transition-all duration-300 ease-out",
                    selectedPeriod === "monthly" ? "left-1" : "left-[calc(50%+2px)]",
                  )}
                />
                <button
                  onClick={() => handlePeriodChange("monthly")}
                  className={cn(
                    "relative z-10 px-6 py-1.5 text-sm font-medium transition-colors duration-300",
                    selectedPeriod === "monthly" ? "text-black" : "text-gray-500",
                  )}
                >
                  Monthly
                </button>
                <button
                  onClick={() => handlePeriodChange("yearly")}
                  className={cn(
                    "relative z-10 px-6 py-1.5 text-sm font-medium transition-colors duration-300",
                    selectedPeriod === "yearly" ? "text-black" : "text-gray-500",
                  )}
                >
                  Yearly
                </button>
              </div>
            </div>
          )}

          {/* ── Error / Warning ── */}
          {checkoutError && (
            <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-center text-sm text-rose-600">
              {checkoutError}
            </div>
          )}
          {user && !user.email_verified && (
            <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm text-amber-700">
              当前账号邮箱尚未验证。你仍可发起支付，但订阅管理入口仍要求邮箱已验证。
            </div>
          )}

          {/* ── Checkout callback banner ── */}
          {checkoutBanner && (
            <div
              className={cn("mb-6 rounded-xl border px-4 py-3 text-center text-sm", {
                "border-sky-200 bg-sky-50 text-sky-700": checkoutBanner.type === "loading",
                "border-emerald-200 bg-emerald-50 text-emerald-700": checkoutBanner.type === "success",
                "border-amber-200 bg-amber-50 text-amber-700": checkoutBanner.type === "pending",
                "border-rose-200 bg-rose-50 text-rose-600": checkoutBanner.type === "failed",
              })}
            >
              {checkoutBanner.type === "loading" && <Loader2 className="mr-2 inline h-4 w-4 animate-spin align-text-bottom" />}
              {checkoutBanner.message}
            </div>
          )}

          {/* ── Cards grid ── */}
          <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-3">
            {/* ── Free ── */}
            <div className="flex flex-col rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
              <div className="mb-6">
                <h3 className="mb-1 text-xl font-bold">Free</h3>
                <p className="text-sm text-gray-500">免费体验基础功能。</p>
              </div>
              <div className="mb-8 flex h-16 items-baseline gap-1">
                <span className="text-4xl font-bold tracking-tight">免费</span>
              </div>
              <div className="flex-grow">
                <ul className="space-y-4 text-sm text-gray-600">
                  {FREE_FEATURES.map((f) => (
                    <li key={f} className="flex items-start gap-3">
                      <Check className="h-5 w-5 shrink-0 text-gray-900" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <button
                disabled
                className="mt-10 w-full cursor-not-allowed rounded-lg border border-gray-200 bg-gray-100 px-4 py-3 font-medium text-gray-400 shadow-sm"
              >
                当前方案
              </button>
            </div>

            {/* ── Plus (highlighted) ── */}
            <div className="relative flex flex-col overflow-hidden rounded-2xl border-2 border-black bg-white p-8 shadow-md">
              {/* mesh gradient */}
              <div
                className="pointer-events-none absolute bottom-0 left-0 right-0 h-48 opacity-80"
                style={{
                  backgroundImage:
                    "radial-gradient(at 100% 100%, rgba(255,184,0,0.2) 0px, transparent 50%), radial-gradient(at 0% 100%, rgba(255,0,128,0.2) 0px, transparent 50%)",
                  filter: "blur(20px)",
                }}
              />

              <div className="relative z-10 mb-6">
                <h3 className="mb-1 text-xl font-bold">Plus</h3>
                <p className="text-sm text-gray-500">适合稳定练习与日常使用。</p>
              </div>

              <div className="relative z-10 mb-8 h-16">
                {renderPriceArea(plusPlan, isWechatProductsLoading, selectedMode === "wechat")}
              </div>

              <div className="relative z-10 flex-grow">
                <ul className="space-y-4 text-sm text-gray-600">
                  {activeFeatures("plus").map((f) => (
                    <li key={f} className="flex items-start gap-3">
                      <Check className="h-5 w-5 shrink-0 text-gray-900" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="relative z-10 mt-10">
                {selectedMode === "wechat"
                  ? renderWechatCta(plusWechatProducts, "plus")
                  : renderSubscriptionCta(plusPlan, "plus")}
              </div>
            </div>

            {/* ── Pro ── */}
            <div className="relative flex flex-col rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
              <div className="absolute right-6 top-6 z-10">
                <span className="rounded-lg bg-black px-2.5 py-1 text-xs font-medium tracking-wide text-white shadow-sm">
                  更进阶
                </span>
              </div>

              <div className="relative z-10 mb-6">
                <h3 className="mb-1 text-xl font-bold">Pro</h3>
                <p className="text-sm text-gray-500">适合高频率长期的进阶使用。</p>
              </div>

              <div className="relative z-10 mb-8 h-16">
                {renderPriceArea(proPlan, isWechatProductsLoading, selectedMode === "wechat")}
              </div>

              <div className="relative z-10 flex-grow">
                <ul className="space-y-4 text-sm text-gray-600">
                  {activeFeatures("pro").map((f, i) => (
                    <li key={f} className="flex items-start gap-3">
                      <Check className="h-5 w-5 shrink-0 text-gray-900" />
                      <span className={i === 0 ? "font-medium text-black" : ""}>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="relative z-10 mt-10">
                {selectedMode === "wechat"
                  ? renderWechatCta(proWechatProducts, "pro")
                  : renderSubscriptionCta(proPlan, "pro")}
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
