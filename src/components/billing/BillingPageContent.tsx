"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowRight,
  CreditCard,
  ExternalLink,
  Loader2,
  ReceiptText,
  RefreshCcw,
} from "lucide-react";

import type { PaymentItems, SubscriptionItems } from "@dodopayments/better-auth";

import {
  createDodoCustomerPortal,
  listDodoPayments,
  listDodoSubscriptions,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import {
  formatDateTime,
  formatMinorCurrency,
} from "@/lib/billing-plans";
import { getErrorMessage } from "@/lib/error-map";
import WorkspaceFrame from "@/components/layout/WorkspaceFrame";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type SubscriptionRecord = SubscriptionItems["items"][number];
type PaymentRecord = PaymentItems["items"][number];

function getSubscriptionHeadline(subscription: SubscriptionRecord) {
  return subscription.product_name || subscription.product_id;
}

function getSubscriptionAmount(subscription: SubscriptionRecord) {
  return formatMinorCurrency(subscription.recurring_pre_tax_amount, subscription.currency);
}

function getPaymentAmount(payment: PaymentRecord) {
  return formatMinorCurrency(payment.total_amount, payment.currency);
}

function isActiveSubscription(subscription: SubscriptionRecord) {
  return subscription.status === "active" || subscription.status === "on_hold";
}

function isCheckoutSucceeded(status: string | null | undefined) {
  return status === "active" || status === "succeeded";
}

function isCheckoutPending(status: string | null | undefined) {
  return (
    status === "pending" ||
    status === "on_hold" ||
    status === "processing" ||
    status === "requires_customer_action" ||
    status === "requires_merchant_action" ||
    status === "requires_payment_method" ||
    status === "requires_confirmation" ||
    status === "requires_capture" ||
    status === "partially_captured" ||
    status === "partially_captured_and_capturable"
  );
}

function isCheckoutFailed(status: string | null | undefined) {
  return (
    status === "failed" ||
    status === "cancelled" ||
    status === "expired"
  );
}

export default function BillingPageContent() {
  const { user, refreshEntitlements } = useAuth();
  const searchParams = useSearchParams();

  const [subscriptions, setSubscriptions] = useState<SubscriptionRecord[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPortalLoading, setIsPortalLoading] = useState(false);
  const [error, setError] = useState("");

  const checkoutStatus = searchParams.get("checkout");
  const checkoutQueryStatus = searchParams.get("status");
  const checkoutSubscriptionId = searchParams.get("subscription_id");
  const canManageBilling = Boolean(user?.email_verified);

  const loadBillingData = useCallback(async (isBackgroundRefresh = false) => {
    if (!canManageBilling) {
      setSubscriptions([]);
      setPayments([]);
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    if (isBackgroundRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    setError("");

    try {
      const [subscriptionsResponse, paymentsResponse] = await Promise.all([
        listDodoSubscriptions({ page: 1, limit: 20 }),
        listDodoPayments({ page: 1, limit: 20 }),
      ]);

      setSubscriptions(subscriptionsResponse.items);
      setPayments(paymentsResponse.items);

      try {
        await refreshEntitlements();
      } catch (refreshError) {
        setError(getErrorMessage(refreshError));
      }
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [canManageBilling, refreshEntitlements]);

  useEffect(() => {
    void loadBillingData(checkoutStatus === "success");
  }, [checkoutStatus, loadBillingData]);

  async function handleOpenPortal() {
    if (!canManageBilling) {
      return;
    }

    setIsPortalLoading(true);
    setError("");

    try {
      const portal = await createDodoCustomerPortal();
      window.location.assign(portal.url);
    } catch (portalError) {
      setError(getErrorMessage(portalError));
    } finally {
      setIsPortalLoading(false);
    }
  }

  const activeSubscription = subscriptions.find(isActiveSubscription) ?? null;
  const checkoutSubscription =
    checkoutSubscriptionId
      ? subscriptions.find((subscription) => subscription.subscription_id === checkoutSubscriptionId) ?? null
      : null;
  const checkoutPayment =
    checkoutSubscriptionId
      ? payments.find((payment) => payment.subscription_id === checkoutSubscriptionId) ?? null
      : null;
  const resolvedCheckoutStatus =
    checkoutPayment?.status ||
    checkoutSubscription?.status ||
    checkoutQueryStatus;

  return (
    <WorkspaceFrame>
      <div className="flex-1 overflow-y-auto bg-[var(--workspace-bg)]">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-6 pb-16">
          <div className="rounded-[28px] border border-black/5 bg-white/80 p-6 shadow-[0_24px_70px_rgba(16,24,40,0.08)] backdrop-blur-xl">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <div className="text-sm font-medium text-[var(--text-secondary)]">
                  订阅与账单
                </div>
                <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--text-primary)]">
                  在一个页面查看当前订阅、最近支付和 Dodo 托管管理入口。
                </h1>
                <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
                  支付成功后会自动返回这里；后续变更套餐、查看支付历史，也都从这里进入。
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void loadBillingData(true)}
                  disabled={isLoading || isRefreshing || !canManageBilling}
                >
                  {isRefreshing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      刷新中
                    </>
                  ) : (
                    <>
                      <RefreshCcw className="h-4 w-4" />
                      刷新数据
                    </>
                  )}
                </Button>
                <Button type="button" onClick={handleOpenPortal} disabled={isPortalLoading || !canManageBilling}>
                  {isPortalLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      跳转中
                    </>
                  ) : (
                    <>
                      管理订阅
                      <ExternalLink className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </div>

            {checkoutStatus === "success" && isLoading ? (
              <div className="mt-5 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-700">
                正在同步最新支付状态，请稍候。
              </div>
            ) : null}

            {checkoutStatus === "success" && !isLoading && isCheckoutSucceeded(resolvedCheckoutStatus) ? (
              <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                支付已完成，订阅与账单信息已同步。
              </div>
            ) : null}

            {checkoutStatus === "success" && !isLoading && isCheckoutPending(resolvedCheckoutStatus) ? (
              <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                支付会话已创建，但当前支付还没有最终完成。请继续在 Dodo Checkout 或订阅管理中补全支付方式。
              </div>
            ) : null}

            {checkoutStatus === "success" && !isLoading && isCheckoutFailed(resolvedCheckoutStatus) ? (
              <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
                支付未完成，请检查支付状态后重新尝试。
              </div>
            ) : null}

            {!canManageBilling ? (
              <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                当前账号邮箱尚未验证，暂时无法调用 Dodo 的订阅管理与账单查询接口。
              </div>
            ) : null}

            {error ? (
              <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
                {error}
              </div>
            ) : null}
          </div>

          <section className="grid gap-4 md:grid-cols-3">
            <Card className="border-black/5 bg-white/80 py-0">
              <CardHeader className="pb-4 pt-5">
                <CardDescription>当前主订阅</CardDescription>
                <CardTitle className="text-xl">
                  {activeSubscription ? getSubscriptionHeadline(activeSubscription) : "暂无进行中的订阅"}
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-5 text-sm text-[var(--text-secondary)]">
                {activeSubscription ? (
                  <>
                    <div>状态：{activeSubscription.status}</div>
                    <div className="mt-2">当前周期：{formatDateTime(activeSubscription.previous_billing_date)}</div>
                    <div className="mt-2">下次扣费：{formatDateTime(activeSubscription.next_billing_date)}</div>
                  </>
                ) : (
                  <div>还没有进行中的订阅，可以先前往定价页选择套餐。</div>
                )}
              </CardContent>
              <CardFooter className="border-t border-black/5 py-4">
                <Link href="/pricing?period=monthly" className="text-sm font-medium text-[#0b66ff]">
                  前往定价页 <ArrowRight className="ml-1 inline h-4 w-4" />
                </Link>
              </CardFooter>
            </Card>

            <Card className="border-black/5 bg-white/80 py-0">
              <CardHeader className="pb-4 pt-5">
                <CardDescription>最近支付</CardDescription>
                <CardTitle className="text-xl">
                  {payments[0] ? getPaymentAmount(payments[0]) : "暂无支付记录"}
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-5 text-sm text-[var(--text-secondary)]">
                {payments[0] ? (
                  <>
                    <div>状态：{payments[0].status ?? "未知"}</div>
                    <div className="mt-2">支付时间：{formatDateTime(payments[0].created_at)}</div>
                    <div className="mt-2">方式：{payments[0].payment_method || "暂未提供"}</div>
                  </>
                ) : (
                  <div>支付完成后，这里会展示最近一笔账单信息。</div>
                )}
              </CardContent>
              <CardFooter className="border-t border-black/5 py-4">
                <div className="text-sm text-[var(--text-secondary)]">
                  Dodo 会返回实时支付状态，不在本地做 shadow copy。
                </div>
              </CardFooter>
            </Card>

            <Card className="border-black/5 bg-white/80 py-0">
              <CardHeader className="pb-4 pt-5">
                <CardDescription>当前账号</CardDescription>
                <CardTitle className="text-xl">
                  {user?.email || "未登录"}
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-5 text-sm text-[var(--text-secondary)]">
                <div>邮箱验证：{user?.email_verified ? "已验证" : "未验证"}</div>
                <div className="mt-2">订阅数量：{subscriptions.length}</div>
                <div className="mt-2">支付数量：{payments.length}</div>
              </CardContent>
              <CardFooter className="border-t border-black/5 py-4">
                <div className="text-sm text-[var(--text-secondary)]">
                  Billing 页面只负责查看与跳转管理，不在本期做套餐权限 gating。
                </div>
              </CardFooter>
            </Card>
          </section>

          <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
            <Card className="border-black/5 bg-white/85 py-0">
              <CardHeader className="border-b border-black/5 pb-4 pt-5">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-[var(--text-secondary)]" />
                  <CardTitle className="text-lg">订阅列表</CardTitle>
                </div>
                <CardDescription>展示 Dodo 返回的最新订阅状态。</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 py-5">
                {isLoading ? (
                  <div className="flex items-center justify-center py-12 text-[var(--text-secondary)]">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </div>
                ) : subscriptions.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-black/10 bg-black/[0.02] px-4 py-6 text-sm text-[var(--text-secondary)]">
                    暂无订阅记录。
                  </div>
                ) : (
                  subscriptions.map((subscription) => (
                    <div
                      key={subscription.subscription_id}
                      className="rounded-2xl border border-black/6 bg-black/[0.02] px-4 py-4"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="text-base font-medium text-[var(--text-primary)]">
                            {getSubscriptionHeadline(subscription)}
                          </div>
                          <div className="mt-1 text-sm text-[var(--text-secondary)]">
                            {getSubscriptionAmount(subscription)} / {subscription.payment_frequency_interval.toLowerCase()}
                          </div>
                        </div>
                        <span className="rounded-full bg-black/[0.06] px-3 py-1 text-xs font-medium text-[var(--text-secondary)]">
                          {subscription.status}
                        </span>
                      </div>
                      <div className="mt-4 grid gap-2 text-sm text-[var(--text-secondary)] sm:grid-cols-2">
                        <div>开始周期：{formatDateTime(subscription.previous_billing_date)}</div>
                        <div>下次扣费：{formatDateTime(subscription.next_billing_date)}</div>
                        <div>订阅 ID：{subscription.subscription_id}</div>
                        <div>商品 ID：{subscription.product_id}</div>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="border-black/5 bg-white/85 py-0">
              <CardHeader className="border-b border-black/5 pb-4 pt-5">
                <div className="flex items-center gap-2">
                  <ReceiptText className="h-4 w-4 text-[var(--text-secondary)]" />
                  <CardTitle className="text-lg">支付记录</CardTitle>
                </div>
                <CardDescription>最近 20 条支付信息。</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 py-5">
                {isLoading ? (
                  <div className="flex items-center justify-center py-12 text-[var(--text-secondary)]">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </div>
                ) : payments.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-black/10 bg-black/[0.02] px-4 py-6 text-sm text-[var(--text-secondary)]">
                    暂无支付记录。
                  </div>
                ) : (
                  payments.map((payment) => (
                    <div
                      key={payment.payment_id}
                      className="rounded-2xl border border-black/6 bg-black/[0.02] px-4 py-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-base font-medium text-[var(--text-primary)]">
                          {getPaymentAmount(payment)}
                        </div>
                        <span className="rounded-full bg-black/[0.06] px-3 py-1 text-xs font-medium text-[var(--text-secondary)]">
                          {payment.status ?? "未知"}
                        </span>
                      </div>
                      <div className="mt-3 space-y-2 text-sm text-[var(--text-secondary)]">
                        <div>支付时间：{formatDateTime(payment.created_at)}</div>
                        <div>支付方式：{payment.payment_method || "暂未提供"}</div>
                        <div>支付 ID：{payment.payment_id}</div>
                        {payment.subscription_id ? (
                          <div>关联订阅：{payment.subscription_id}</div>
                        ) : null}
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </section>
        </div>
      </div>
    </WorkspaceFrame>
  );
}
