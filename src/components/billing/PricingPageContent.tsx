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
} from "lucide-react";

import { useAuth } from "@/lib/auth-context";
import { createDodoCheckoutSession } from "@/lib/api";
import {
  buildPricingPath,
  getBillingPeriodFromValue,
  getPricingPlanBySlug,
  getPricingPlansForPeriod,
  type BillingPeriod,
  type PricingCatalogPlan,
} from "@/lib/billing-plans";
import { getErrorMessage } from "@/lib/error-map";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface PricingPageContentProps {
  catalog: PricingCatalogPlan[];
}

const PERIOD_TABS: Array<{ value: BillingPeriod; label: string }> = [
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];

function getPlansForDisplay(catalog: PricingCatalogPlan[], period: BillingPeriod) {
  const planOrder = getPricingPlansForPeriod(period).map((plan) => plan.slug);
  return catalog
    .filter((plan) => plan.period === period)
    .sort((left, right) => planOrder.indexOf(left.slug) - planOrder.indexOf(right.slug));
}

export default function PricingPageContent({ catalog }: PricingPageContentProps) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [checkoutError, setCheckoutError] = useState("");
  const [pendingSlug, setPendingSlug] = useState<string | null>(null);
  const handledAutoCheckoutRef = useRef<Set<string>>(new Set());

  const selectedPeriod = getBillingPeriodFromValue(searchParams.get("period"));
  const checkoutSlug = searchParams.get("checkout");
  const visiblePlans = getPlansForDisplay(catalog, selectedPeriod);

  const beginCheckout = useCallback(async (slug: string) => {
    setCheckoutError("");
    setPendingSlug(slug);

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
      setPendingSlug(null);
    }
  }, []);

  useEffect(() => {
    if (!user || !checkoutSlug) {
      return;
    }

    const plan = getPricingPlanBySlug(checkoutSlug);
    if (!plan || handledAutoCheckoutRef.current.has(plan.slug)) {
      return;
    }

    handledAutoCheckoutRef.current.add(plan.slug);
    router.replace(buildPricingPath({ period: plan.period }));
    void beginCheckout(plan.slug);
  }, [beginCheckout, checkoutSlug, router, user]);

  function handlePeriodChange(period: BillingPeriod) {
    router.replace(buildPricingPath({ period }));
  }

  function handlePurchase(slug: string) {
    const plan = getPricingPlanBySlug(slug);
    if (!plan) {
      setCheckoutError("当前套餐暂时不可购买，请稍后重试");
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

    void beginCheckout(plan.slug);
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
                <Link href="/billing">管理订阅</Link>
              </Button>
            ) : (
              <Button asChild variant="outline">
                <Link href="/login">登录</Link>
              </Button>
            )}
          </div>
        </header>

        <main className="flex flex-1 flex-col justify-center py-12 sm:py-16">
          <section className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-sm font-medium text-amber-700">
                <ShieldCheck className="h-4 w-4" />
                支付由 Dodo Payments 托管处理
              </div>
              <h1 className="mt-6 max-w-4xl text-4xl font-semibold leading-tight tracking-tight text-[var(--text-primary)] sm:text-5xl">
                用最短路径完成 ParlaSoul 订阅购买，
                <span className="block text-[#b45f0a]">在 Monthly 与 Yearly 之间自由切换。</span>
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-[var(--text-secondary)] sm:text-lg">
                定价页对所有访客开放。点击购买时若尚未登录，会先完成身份校验，再自动跳回并继续发起真实 Dodo Checkout。
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
              </div>

              {checkoutError ? (
                <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
                  {checkoutError}
                </div>
              ) : null}

              {user && user.email_verified === false ? (
                <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                  当前账号邮箱尚未验证。你仍可发起购买，但订阅管理页会要求已验证邮箱才能查看完整订阅与支付记录。
                </div>
              ) : null}
            </div>

            <div className="rounded-[28px] border border-black/5 bg-white/75 p-6 shadow-[0_24px_80px_rgba(22,24,35,0.08)] backdrop-blur-xl">
              <div className="flex items-center gap-2 text-sm font-medium text-[var(--text-secondary)]">
                <Sparkles className="h-4 w-4 text-[#f59e0b]" />
                当前展示
              </div>
              <div className="mt-4 text-3xl font-semibold tracking-tight text-[var(--text-primary)]">
                {selectedPeriod === "monthly" ? "月付方案" : "年付方案"}
              </div>
              <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
                所有购买都通过同一套 Better Auth 登录态发起，支付成功后自动返回账单页。
              </p>
              <div className="mt-6 grid gap-3 text-sm text-[var(--text-secondary)]">
                <div className="rounded-2xl bg-black/[0.03] px-4 py-3">
                  1. 选择周期与档位
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

          <section className="mt-12 grid gap-6 lg:grid-cols-2">
            {visiblePlans.map((plan) => {
              const isPending = pendingSlug === plan.slug;

              return (
                <Card
                  key={plan.slug}
                  className={cn(
                    "overflow-hidden border-black/5 bg-white/85 py-0 shadow-[0_18px_60px_rgba(16,24,40,0.08)]",
                    plan.tier === "pro" && "border-[#f5b252] shadow-[0_24px_72px_rgba(245,178,82,0.18)]",
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
                        <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                          {plan.accentLabel}
                        </span>
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
                  <CardContent className="pt-6">
                    <ul className="space-y-3 text-sm leading-6 text-[var(--text-secondary)]">
                      {plan.featurePoints.map((point) => (
                        <li key={point} className="flex items-start gap-3">
                          <span className="mt-1 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                            <Check className="h-3.5 w-3.5" />
                          </span>
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                  <CardFooter className="justify-between border-t border-black/5 py-5">
                    <div className="text-xs text-[var(--text-tertiary)]">
                      {user ? "将直接创建 Dodo Checkout Session" : "登录后会自动继续购买"}
                    </div>
                    <Button
                      type="button"
                      onClick={() => handlePurchase(plan.slug)}
                      disabled={isPending || isLoading}
                      className={cn(
                        "min-w-[148px] rounded-full",
                        plan.tier === "pro" && "bg-[#161616] text-white hover:bg-[#0a0a0a]",
                      )}
                    >
                      {isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          正在跳转
                        </>
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
        </main>
      </div>
    </div>
  );
}
