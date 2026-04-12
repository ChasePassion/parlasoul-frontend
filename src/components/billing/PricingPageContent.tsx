"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  Check,
  Loader2,
  ShieldCheck,
  Sparkles,
  WalletCards,
} from "lucide-react";

import { useAuth } from "@/lib/auth-context";
import {
  createDodoCheckoutSession,
  createWechatCheckoutSession,
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface PricingPageContentProps {
  catalog: PricingCatalogPlan[];
}

const PERIOD_TABS: Array<{ value: BillingPeriod; label: string }> = [
  { value: "monthly", label: "月付" },
  { value: "yearly", label: "年付" },
];

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
  if (!isTierBlocked(currentTier, targetTier)) {
    return null;
  }

  if (currentTier === targetTier) {
    return `你已拥有有效的 ${targetTier === "plus" ? "Plus" : "Pro"} 权益`;
  }

  return "你已拥有更高阶的有效权益，无需重复购买当前档位";
}

function formatDurationLabel(durationDays: number) {
  return durationDays >= 365 ? "365 天" : `${durationDays} 天`;
}

export default function PricingPageContent({ catalog }: PricingPageContentProps) {
  const { user, entitlements, isLoading, isEntitlementsLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [checkoutError, setCheckoutError] = useState("");
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [wechatProducts, setWechatProducts] = useState<WechatPaymentProduct[]>([]);
  const [isWechatProductsLoading, setIsWechatProductsLoading] = useState(true);
  const handledAutoCheckoutRef = useRef<Set<string>>(new Set());

  const selectedPeriod = getBillingPeriodFromValue(searchParams.get("period"));
  const selectedMode = getPricingModeFromValue(searchParams.get("mode"));
  const checkoutSlug = searchParams.get("checkout");
  const pendingWechatProductId = searchParams.get("product_id");
  const visiblePlans = getPlansForDisplay(catalog, selectedPeriod);
  const currentTier = entitlements?.tier ?? "free";
  const busyWithEntitlements = Boolean(user) && isEntitlementsLoading;

  const beginSubscriptionCheckout = useCallback(async (slug: string) => {
    setCheckoutError("");
    setPendingKey(`subscription:${slug}`);

    try {
      const checkoutSession = await createDodoCheckoutSession({
        slug,
        referenceId: `pricing:${slug}:${Date.now()}`,
      });
      window.location.assign(checkoutSession.url);
      return;
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
      const checkoutSession = await createWechatCheckoutSession({
        product_id: productId,
      });
      window.location.assign(checkoutSession.checkout_url);
      return;
    } catch (error) {
      setCheckoutError(getErrorMessage(error));
    } finally {
      setPendingKey(null);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    setIsWechatProductsLoading(true);

    void getWechatPaymentProducts()
      .then((response) => {
        if (cancelled) {
          return;
        }
        setWechatProducts(response.items);
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        setCheckoutError(getErrorMessage(error));
      })
      .finally(() => {
        if (!cancelled) {
          setIsWechatProductsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!user || !checkoutSlug) {
      return;
    }

    const plan = getPricingPlanBySlug(checkoutSlug);
    if (!plan || handledAutoCheckoutRef.current.has(`subscription:${plan.slug}`)) {
      return;
    }

    handledAutoCheckoutRef.current.add(`subscription:${plan.slug}`);
    void beginSubscriptionCheckout(plan.slug);
  }, [beginSubscriptionCheckout, checkoutSlug, user]);

  useEffect(() => {
    if (!user || selectedMode !== "wechat" || !pendingWechatProductId) {
      return;
    }

    const key = `wechat:${pendingWechatProductId}`;
    if (handledAutoCheckoutRef.current.has(key)) {
      return;
    }

    handledAutoCheckoutRef.current.add(key);
    void beginWechatCheckout(pendingWechatProductId);
  }, [
    beginWechatCheckout,
    pendingWechatProductId,
    selectedMode,
    user,
  ]);

  function handlePeriodChange(period: BillingPeriod) {
    router.replace(
      buildPricingPath({
        period,
        mode: selectedMode,
      }),
    );
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

    const nextPath = buildPricingPath({
      period: plan.period,
      checkout: plan.slug,
    });

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

    const nextPath = buildPricingPath({
      period: selectedPeriod,
      mode: "wechat",
      productId,
    });

    if (!user) {
      router.push(`/login?next=${encodeURIComponent(nextPath)}`);
      return;
    }

    void beginWechatCheckout(productId);
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#fff4df_0%,#fffaf2_32%,#f8f8f6_65%,#ffffff_100%)] text-[var(--text-primary)]">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-6 py-6 sm:px-8 lg:px-12">
        <header className="flex items-center justify-between gap-4 rounded-full border border-black/5 bg-white/80 px-5 py-3 shadow-[0_12px_40px_rgba(16,24,40,0.08)] backdrop-blur-xl">
          <Link href="/" className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">
            ParlaSoul
          </Link>
          <div className="flex items-center gap-3">
            {user ? (
              <Button asChild variant="outline">
                <Link href="/billing">查看账单</Link>
              </Button>
            ) : (
              <Button asChild variant="outline">
                <Link href="/login">登录</Link>
              </Button>
            )}
          </div>
        </header>

        <main className="flex flex-1 flex-col justify-center py-12 sm:py-16">
          <section className="grid gap-10 lg:grid-cols-[1.08fr_0.92fr] lg:items-end">
            <div className="max-w-3xl">
              <Badge className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-sm font-medium text-amber-700 shadow-none hover:bg-amber-50">
                <ShieldCheck />
                支付由 Dodo Payments 托管处理
              </Badge>
              <h1 className="mt-6 max-w-4xl text-4xl font-semibold leading-tight tracking-tight text-[var(--text-primary)] sm:text-5xl">
                在一个页面里完成订阅购买或
                <span className="block text-[#b45f0a]">微信一次性开通权益。</span>
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-[var(--text-secondary)] sm:text-lg">
                定价页对所有访客开放。未登录时会先完成身份校验，再自动返回并继续发起真实支付；已生效的同档位权益会直接阻止重复购买。
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                {PERIOD_TABS.map((tab) => (
                  <button
                    key={tab.value}
                    type="button"
                    onClick={() => handlePeriodChange(tab.value)}
                    className={cn(
                      "rounded-full border px-4 py-2 text-sm font-medium transition-all",
                      selectedPeriod === tab.value
                        ? "border-[#161616] bg-[#161616] text-white shadow-[0_12px_28px_rgba(22,22,22,0.18)]"
                        : "border-black/10 bg-white text-[var(--text-secondary)] hover:border-black/20 hover:text-[var(--text-primary)]",
                    )}
                  >
                    {tab.label}
                  </button>
                ))}

                <Button
                  asChild
                  variant={selectedMode === "wechat" ? "default" : "outline"}
                  className="rounded-full"
                >
                  <Link
                    href={buildPricingPath({
                      period: selectedPeriod,
                      mode: selectedMode === "wechat" ? "subscription" : "wechat",
                    })}
                  >
                    {selectedMode === "wechat" ? "返回订阅方案" : "切换到微信支付"}
                  </Link>
                </Button>
              </div>

              {checkoutError ? (
                <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
                  {checkoutError}
                </div>
              ) : null}

              {user && user.email_verified === false ? (
                <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                  当前账号邮箱尚未验证。你仍可发起支付，但订阅管理入口仍要求邮箱已验证。
                </div>
              ) : null}
            </div>

            <div className="rounded-[28px] border border-black/5 bg-white/75 p-6 shadow-[0_24px_80px_rgba(22,24,35,0.08)] backdrop-blur-xl">
              <div className="flex items-center gap-2 text-sm font-medium text-[var(--text-secondary)]">
                {selectedMode === "wechat" ? (
                  <WalletCards className="h-4 w-4 text-[#b45f0a]" />
                ) : (
                  <Sparkles className="h-4 w-4 text-[#f59e0b]" />
                )}
                当前视图
              </div>
              <div className="mt-4 text-3xl font-semibold tracking-tight text-[var(--text-primary)]">
                {selectedMode === "wechat" ? "微信一次性支付" : "订阅方案"}
              </div>
              <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
                {selectedMode === "wechat"
                  ? "微信支付固定走人民币结算，最终金额以 Dodo Checkout 展示为准。支付完成后会返回账单页并刷新本地权益。"
                  : "订阅仍走现有 Better Auth + Dodo Checkout 主线，不会被微信一次性支付改动打断。"}
              </p>
              <div className="mt-6 flex flex-col gap-3 text-sm text-[var(--text-secondary)]">
                <div className="rounded-2xl bg-black/[0.03] px-4 py-3">
                  1. 选择你要购买的权益与时长
                </div>
                <div className="rounded-2xl bg-black/[0.03] px-4 py-3">
                  2. 登录后创建真实 Dodo Checkout Session
                </div>
                <div className="rounded-2xl bg-black/[0.03] px-4 py-3">
                  3. 支付完成后回到 `/billing`
                </div>
              </div>
            </div>
          </section>

          {selectedMode === "wechat" ? (
            <section className="mt-12 grid gap-6 lg:grid-cols-2">
              {isWechatProductsLoading
                ? Array.from({ length: 4 }).map((_, index) => (
                    <Card
                      key={`wechat-skeleton-${index}`}
                      className="overflow-hidden border-black/5 bg-white/85 py-0 shadow-[0_18px_60px_rgba(16,24,40,0.08)]"
                    >
                      <CardHeader className="pb-5 pt-6">
                        <Skeleton className="h-6 w-44 rounded-full" />
                        <Skeleton className="mt-4 h-4 w-full rounded-full" />
                        <Skeleton className="h-4 w-2/3 rounded-full" />
                      </CardHeader>
                      <CardContent className="flex flex-col gap-3 pt-1">
                        <Skeleton className="h-16 w-full rounded-2xl" />
                        <Skeleton className="h-16 w-full rounded-2xl" />
                      </CardContent>
                      <CardFooter className="py-5">
                        <Skeleton className="h-11 w-full rounded-full" />
                      </CardFooter>
                    </Card>
                  ))
                : wechatProducts.map((product) => {
                    const blocked = isTierBlocked(currentTier, product.tier);
                    const isPending = pendingKey === `wechat:${product.product_id}`;
                    const blockMessage = getTierBlockMessage(currentTier, product.tier);

                    return (
                      <Card
                        key={product.product_id}
                        className={cn(
                          "overflow-hidden border-black/5 bg-white/85 py-0 shadow-[0_18px_60px_rgba(16,24,40,0.08)]",
                          product.tier === "pro" &&
                            "border-[#f5b252] shadow-[0_24px_72px_rgba(245,178,82,0.18)]",
                        )}
                      >
                        <CardHeader className="border-b border-black/5 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(251,246,238,0.94))] pb-5 pt-6">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex flex-col gap-2">
                              <CardTitle className="text-2xl tracking-tight text-[var(--text-primary)]">
                                {product.tier === "plus" ? "Plus" : "Pro"} · {formatDurationLabel(product.duration_days)}
                              </CardTitle>
                              <CardDescription className="text-sm leading-6 text-[var(--text-secondary)]">
                                一次支付，立即开通对应时长的完整权益。当前视图只展示权益和时长，不在本地渲染人民币价格。
                              </CardDescription>
                            </div>
                            <Badge
                              variant="secondary"
                              className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700"
                            >
                              微信支付
                            </Badge>
                          </div>

                          <div className="mt-4 flex flex-wrap gap-2 text-xs text-[var(--text-secondary)]">
                            <span className="rounded-full bg-black/[0.04] px-3 py-1">
                              人民币结算
                            </span>
                            <span className="rounded-full bg-black/[0.04] px-3 py-1">
                              最终金额以结账页为准
                            </span>
                            <span className="rounded-full bg-black/[0.04] px-3 py-1">
                              商品 ID：{product.product_id}
                            </span>
                          </div>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-3 pt-6 text-sm leading-6 text-[var(--text-secondary)]">
                          <div className="rounded-2xl bg-black/[0.03] px-4 py-4">
                            <div className="font-medium text-[var(--text-primary)]">已包含权益</div>
                            <div className="mt-2 flex items-start gap-3">
                              <span className="mt-1 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                                <Check className="h-3.5 w-3.5" />
                              </span>
                              <span>音色克隆与记忆功能会立即跟随本地 entitlement 生效。</span>
                            </div>
                          </div>
                          <div className="rounded-2xl bg-black/[0.03] px-4 py-4">
                            <div className="font-medium text-[var(--text-primary)]">支付说明</div>
                            <p className="mt-2">{product.price_note}</p>
                          </div>
                        </CardContent>
                        <CardFooter className="flex flex-col gap-3 border-t border-black/5 py-5">
                          {blockMessage ? (
                            <div className="w-full rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                              {blockMessage}
                            </div>
                          ) : null}
                          <Button
                            type="button"
                            onClick={() =>
                              handleWechatPurchase(product.product_id, product.tier)
                            }
                            disabled={blocked || isPending || isLoading || busyWithEntitlements}
                            className={cn(
                              "w-full rounded-full",
                              product.tier === "pro" &&
                                "bg-[#161616] text-white hover:bg-[#0a0a0a]",
                            )}
                          >
                            {isPending ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                正在跳转
                              </>
                            ) : blocked ? (
                              "当前不可重复购买"
                            ) : (
                              <>
                                立即前往支付
                                <ArrowRight className="h-4 w-4" />
                              </>
                            )}
                          </Button>
                        </CardFooter>
                      </Card>
                    );
                  })}
            </section>
          ) : (
            <section className="mt-12 grid gap-6 lg:grid-cols-2">
              {visiblePlans.map((plan) => {
                const blocked = isTierBlocked(currentTier, plan.tier);
                const isPending = pendingKey === `subscription:${plan.slug}`;
                const blockMessage = getTierBlockMessage(currentTier, plan.tier);

                return (
                  <Card
                    key={plan.slug}
                    className={cn(
                      "overflow-hidden border-black/5 bg-white/85 py-0 shadow-[0_18px_60px_rgba(16,24,40,0.08)]",
                      plan.tier === "pro" &&
                        "border-[#f5b252] shadow-[0_24px_72px_rgba(245,178,82,0.18)]",
                    )}
                  >
                    <CardHeader className="border-b border-black/5 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(251,246,238,0.94))] pb-5 pt-6">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <CardTitle className="text-2xl tracking-tight text-[var(--text-primary)]">
                            {plan.tierLabel}
                          </CardTitle>
                          <CardDescription className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                            {plan.summary}
                          </CardDescription>
                        </div>
                        {plan.accentLabel ? (
                          <Badge
                            variant="secondary"
                            className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700"
                          >
                            {plan.accentLabel}
                          </Badge>
                        ) : null}
                      </div>
                      <div className="mt-6 flex items-end gap-2">
                        <span className="text-4xl font-semibold tracking-tight text-[var(--text-primary)]">
                          {plan.priceDisplay}
                        </span>
                        <span className="pb-1 text-sm text-[var(--text-secondary)]">
                          {plan.billingIntervalLabel}
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--text-secondary)]">
                        <span className="rounded-full bg-black/[0.04] px-3 py-1">
                          商品：{plan.productName}
                        </span>
                        {plan.yearlySavingsLabel ? (
                          <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">
                            {plan.yearlySavingsLabel}
                          </span>
                        ) : null}
                        {plan.trialPeriodDays ? (
                          <span className="rounded-full bg-sky-50 px-3 py-1 text-sky-700">
                            试用 {plan.trialPeriodDays} 天
                          </span>
                        ) : null}
                      </div>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-3 pt-6 text-sm leading-6 text-[var(--text-secondary)]">
                      {plan.featurePoints.map((point) => (
                        <div key={point} className="flex items-start gap-3">
                          <span className="mt-1 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                            <Check className="h-3.5 w-3.5" />
                          </span>
                          <span>{point}</span>
                        </div>
                      ))}
                    </CardContent>
                    <CardFooter className="flex flex-col gap-3 border-t border-black/5 py-5">
                      {blockMessage ? (
                        <div className="w-full rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                          {blockMessage}
                        </div>
                      ) : null}
                      <Button
                        type="button"
                        onClick={() => handleSubscriptionPurchase(plan.slug)}
                        disabled={blocked || isPending || isLoading || busyWithEntitlements}
                        className={cn(
                          "w-full rounded-full",
                          plan.tier === "pro" &&
                            "bg-[#161616] text-white hover:bg-[#0a0a0a]",
                        )}
                      >
                        {isPending ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            正在跳转
                          </>
                        ) : blocked ? (
                          "当前不可重复购买"
                        ) : (
                          <>
                            立即购买
                            <ArrowRight className="h-4 w-4" />
                          </>
                        )}
                      </Button>
                    </CardFooter>
                  </Card>
                );
              })}
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
