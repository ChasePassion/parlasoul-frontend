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
  ShieldCheck,
  WalletCards,
} from "lucide-react";

import type { PaymentItems, SubscriptionItems } from "@dodopayments/better-auth";

import {
  createDodoCustomerPortal,
  getWechatPaymentOrder,
  listDodoPayments,
  listDodoSubscriptions,
  listWechatPaymentOrders,
} from "@/lib/api";
import type { PaymentOrderResponse } from "@/lib/api-service";
import { useAuth } from "@/lib/auth-context";
import {
  formatDateTime,
  formatMinorCurrency,
} from "@/lib/billing-plans";
import { getErrorMessage } from "@/lib/error-map";
import WorkspaceFrame from "@/components/layout/WorkspaceFrame";
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

function getOrderAmount(order: PaymentOrderResponse) {
  if (order.charged_total_minor == null || !order.charged_currency) {
    return "以结账页金额为准";
  }

  return formatMinorCurrency(order.charged_total_minor, order.charged_currency);
}

function isActiveSubscription(subscription: SubscriptionRecord) {
  return subscription.status === "active" || subscription.status === "on_hold";
}

function isRecurringCheckoutSucceeded(status: string | null | undefined) {
  return status === "active" || status === "succeeded";
}

function isRecurringCheckoutPending(status: string | null | undefined) {
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

function isRecurringCheckoutFailed(status: string | null | undefined) {
  return status === "failed" || status === "cancelled" || status === "expired";
}

function isWechatCheckoutSucceeded(status: PaymentOrderResponse["status"] | null | undefined) {
  return status === "succeeded";
}

function isWechatCheckoutPending(status: PaymentOrderResponse["status"] | null | undefined) {
  return status === "created" || status === "checkout_created" || status === "pending";
}

function isWechatCheckoutFailed(status: PaymentOrderResponse["status"] | null | undefined) {
  return status === "failed" || status === "cancelled" || status === "expired";
}

function formatTierLabel(value: "free" | "plus" | "pro" | null | undefined) {
  if (value === "pro") {
    return "Pro";
  }
  if (value === "plus") {
    return "Plus";
  }
  return "Free";
}

function formatEffectiveSource(value: string | null | undefined) {
  if (value === "one_time_pass") {
    return "微信一次性权益";
  }
  if (value === "recurring_subscription") {
    return "订阅权益";
  }
  return "暂无付费权益";
}

export default function BillingPageContent() {
  const { user, entitlements, refreshEntitlements } = useAuth();
  const searchParams = useSearchParams();

  const [subscriptions, setSubscriptions] = useState<SubscriptionRecord[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [wechatOrders, setWechatOrders] = useState<PaymentOrderResponse[]>([]);
  const [checkoutOrder, setCheckoutOrder] = useState<PaymentOrderResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPortalLoading, setIsPortalLoading] = useState(false);
  const [error, setError] = useState("");

  const checkoutStatus = searchParams.get("checkout");
  const checkoutQueryStatus = searchParams.get("status");
  const checkoutSubscriptionId = searchParams.get("subscription_id");
  const checkoutChannel = searchParams.get("channel");
  const checkoutOrderId = searchParams.get("order_id");
  const canManageBilling = Boolean(user?.email_verified);

  const loadBillingData = useCallback(async (isBackgroundRefresh = false) => {
    if (isBackgroundRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    setError("");

    try {
      const [
        orderItems,
        orderDetail,
        subscriptionsResponse,
        paymentsResponse,
      ] = await Promise.all([
        listWechatPaymentOrders({ channel: "wechat_pay", skip: 0, limit: 20 }),
        checkoutChannel === "wechat" && checkoutOrderId
          ? getWechatPaymentOrder(checkoutOrderId)
          : Promise.resolve(null),
        canManageBilling
          ? listDodoSubscriptions({ page: 1, limit: 20 })
          : Promise.resolve(null),
        canManageBilling
          ? listDodoPayments({ page: 1, limit: 20 })
          : Promise.resolve(null),
      ]);

      setWechatOrders(orderItems);
      setCheckoutOrder(orderDetail);
      setSubscriptions(subscriptionsResponse?.items ?? []);
      setPayments(paymentsResponse?.items ?? []);

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
  }, [canManageBilling, checkoutChannel, checkoutOrderId, refreshEntitlements]);

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
  const activePass = entitlements?.active_pass ?? null;
  const checkoutSubscription =
    checkoutSubscriptionId
      ? subscriptions.find(
          (subscription) => subscription.subscription_id === checkoutSubscriptionId,
        ) ?? null
      : null;
  const checkoutPayment =
    checkoutSubscriptionId
      ? payments.find((payment) => payment.subscription_id === checkoutSubscriptionId) ?? null
      : null;
  const resolvedRecurringStatus =
    checkoutPayment?.status || checkoutSubscription?.status || checkoutQueryStatus;

  return (
    <WorkspaceFrame>
      <div className="flex-1 overflow-y-auto bg-[var(--workspace-bg)]">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-6 pb-16">
          <div className="rounded-[28px] border border-black/5 bg-white/80 p-6 shadow-[0_24px_70px_rgba(16,24,40,0.08)] backdrop-blur-xl">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <div className="text-sm font-medium text-[var(--text-secondary)]">
                  账单与权益
                </div>
                <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--text-primary)]">
                  在一个页面查看当前权益、微信一次性订单、订阅状态和 Dodo 托管管理入口。
                </h1>
                <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
                  微信一次性支付以本地订单和 entitlement 为准；订阅管理与远端支付记录仍由 Dodo 直接提供。
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void loadBillingData(true)}
                  disabled={isLoading || isRefreshing}
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
                <Button
                  type="button"
                  onClick={handleOpenPortal}
                  disabled={isPortalLoading || !canManageBilling}
                >
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

            {checkoutStatus === "success" && checkoutChannel === "wechat" && isLoading ? (
              <div className="mt-5 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-700">
                正在同步微信支付结果和最新权益，请稍候。
              </div>
            ) : null}

            {checkoutStatus === "success" &&
            checkoutChannel === "wechat" &&
            !isLoading &&
            isWechatCheckoutSucceeded(checkoutOrder?.status) ? (
              <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                微信支付已完成，本地订单与权益已刷新。
              </div>
            ) : null}

            {checkoutStatus === "success" &&
            checkoutChannel === "wechat" &&
            !isLoading &&
            isWechatCheckoutPending(checkoutOrder?.status) ? (
              <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                订单已创建，正在等待微信支付最终确认。完成支付后可在本页刷新查看最新状态。
              </div>
            ) : null}

            {checkoutStatus === "success" &&
            checkoutChannel === "wechat" &&
            !isLoading &&
            isWechatCheckoutFailed(checkoutOrder?.status) ? (
              <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
                微信支付未完成，请确认支付状态后重新尝试。
              </div>
            ) : null}

            {checkoutStatus === "success" &&
            checkoutChannel !== "wechat" &&
            isLoading ? (
              <div className="mt-5 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-700">
                正在同步最新订阅状态，请稍候。
              </div>
            ) : null}

            {checkoutStatus === "success" &&
            checkoutChannel !== "wechat" &&
            !isLoading &&
            isRecurringCheckoutSucceeded(resolvedRecurringStatus) ? (
              <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                订阅支付已完成，订阅与账单信息已同步。
              </div>
            ) : null}

            {checkoutStatus === "success" &&
            checkoutChannel !== "wechat" &&
            !isLoading &&
            isRecurringCheckoutPending(resolvedRecurringStatus) ? (
              <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                支付会话已创建，但当前支付还没有最终完成。请继续在 Dodo Checkout 或订阅管理中补全支付方式。
              </div>
            ) : null}

            {checkoutStatus === "success" &&
            checkoutChannel !== "wechat" &&
            !isLoading &&
            isRecurringCheckoutFailed(resolvedRecurringStatus) ? (
              <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
                订阅支付未完成，请检查支付状态后重新尝试。
              </div>
            ) : null}

            {!canManageBilling ? (
              <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                当前账号邮箱尚未验证，暂时无法打开 Dodo 的订阅管理与远端账单查询，但微信一次性订单和本地权益仍可正常查看。
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
                <CardDescription>当前生效权益</CardDescription>
                <CardTitle className="text-xl">
                  {formatTierLabel(entitlements?.tier)}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 pb-5 text-sm text-[var(--text-secondary)]">
                <div>来源：{formatEffectiveSource(entitlements?.effective_source)}</div>
                <div>到期：{formatDateTime(entitlements?.effective_expires_at)}</div>
                <div>音色克隆：{entitlements?.features.voice_clone ? "已开通" : "未开通"}</div>
                <div>记忆功能：{entitlements?.features.memory_feature ? "已开通" : "未开通"}</div>
              </CardContent>
            </Card>

            <Card className="border-black/5 bg-white/80 py-0">
              <CardHeader className="pb-4 pt-5">
                <CardDescription>当前一次性权益</CardDescription>
                <CardTitle className="text-xl">
                  {activePass ? `${formatTierLabel(activePass.tier)} · ${formatDateTime(activePass.ends_at)}` : "暂无生效中的一次性权益"}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 pb-5 text-sm text-[var(--text-secondary)]">
                {activePass ? (
                  <>
                    <div>渠道：微信支付</div>
                    <div>开始时间：{formatDateTime(activePass.starts_at)}</div>
                    <div>结束时间：{formatDateTime(activePass.ends_at)}</div>
                    <div>来源订单：{activePass.source_order_id}</div>
                  </>
                ) : (
                  <div>当微信一次性支付生效后，这里会展示当前有效 pass 的开始和结束时间。</div>
                )}
              </CardContent>
              <CardFooter className="border-t border-black/5 py-4">
                <Link
                  href="/pricing?period=monthly&mode=wechat"
                  className="text-sm font-medium text-[#0b66ff]"
                >
                  前往微信支付 <ArrowRight className="ml-1 inline h-4 w-4" />
                </Link>
              </CardFooter>
            </Card>

            <Card className="border-black/5 bg-white/80 py-0">
              <CardHeader className="pb-4 pt-5">
                <CardDescription>当前账号</CardDescription>
                <CardTitle className="text-xl">{user?.email || "未登录"}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 pb-5 text-sm text-[var(--text-secondary)]">
                <div>邮箱验证：{user?.email_verified ? "已验证" : "未验证"}</div>
                <div>订阅数量：{subscriptions.length}</div>
                <div>一次性订单：{wechatOrders.length}</div>
                <div>远端支付记录：{payments.length}</div>
              </CardContent>
            </Card>
          </section>

          <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
            <Card className="border-black/5 bg-white/85 py-0">
              <CardHeader className="border-b border-black/5 pb-4 pt-5">
                <div className="flex items-center gap-2">
                  <WalletCards className="h-4 w-4 text-[var(--text-secondary)]" />
                  <CardTitle className="text-lg">微信一次性订单</CardTitle>
                </div>
                <CardDescription>本地订单状态与权益发放以这里为准。</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4 py-5">
                {isLoading ? (
                  <div className="flex items-center justify-center py-12 text-[var(--text-secondary)]">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </div>
                ) : wechatOrders.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-black/10 bg-black/[0.02] px-4 py-6 text-sm text-[var(--text-secondary)]">
                    暂无微信一次性支付订单。
                  </div>
                ) : (
                  wechatOrders.map((order) => (
                    <div
                      key={order.id}
                      className="rounded-2xl border border-black/6 bg-black/[0.02] px-4 py-4"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="text-base font-medium text-[var(--text-primary)]">
                            {formatTierLabel(order.tier)} · {order.duration_days} 天
                          </div>
                          <div className="mt-1 text-sm text-[var(--text-secondary)]">
                            {getOrderAmount(order)}
                          </div>
                        </div>
                        <Badge
                          variant="secondary"
                          className="w-fit rounded-full bg-black/[0.06] px-3 py-1 text-xs font-medium text-[var(--text-secondary)]"
                        >
                          {order.status}
                        </Badge>
                      </div>

                      <div className="mt-4 grid gap-2 text-sm text-[var(--text-secondary)] sm:grid-cols-2">
                        <div>创建时间：{formatDateTime(order.created_at)}</div>
                        <div>支付时间：{formatDateTime(order.paid_at)}</div>
                        <div>退款时间：{formatDateTime(order.refunded_at)}</div>
                        <div>订单 ID：{order.id}</div>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="border-black/5 bg-white/85 py-0">
              <CardHeader className="border-b border-black/5 pb-4 pt-5">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-[var(--text-secondary)]" />
                  <CardTitle className="text-lg">当前主订阅</CardTitle>
                </div>
                <CardDescription>Recurring 订阅继续由 Dodo 托管。</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 py-5 text-sm text-[var(--text-secondary)]">
                {activeSubscription ? (
                  <>
                    <div className="text-base font-medium text-[var(--text-primary)]">
                      {getSubscriptionHeadline(activeSubscription)}
                    </div>
                    <div>状态：{activeSubscription.status}</div>
                    <div>当前周期：{formatDateTime(activeSubscription.previous_billing_date)}</div>
                    <div>下次扣费：{formatDateTime(activeSubscription.next_billing_date)}</div>
                    <div>
                      金额：{getSubscriptionAmount(activeSubscription)} /{" "}
                      {activeSubscription.payment_frequency_interval.toLowerCase()}
                    </div>
                  </>
                ) : (
                  <div>当前没有进行中的 recurring 订阅，可以从定价页重新选择订阅方案。</div>
                )}
              </CardContent>
              <CardFooter className="border-t border-black/5 py-4">
                <Link href="/pricing?period=monthly" className="text-sm font-medium text-[#0b66ff]">
                  前往订阅方案 <ArrowRight className="ml-1 inline h-4 w-4" />
                </Link>
              </CardFooter>
            </Card>
          </section>

          <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
            <Card className="border-black/5 bg-white/85 py-0">
              <CardHeader className="border-b border-black/5 pb-4 pt-5">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-[var(--text-secondary)]" />
                  <CardTitle className="text-lg">订阅列表</CardTitle>
                </div>
                <CardDescription>展示 Dodo 返回的最新订阅状态。</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4 py-5">
                {!canManageBilling ? (
                  <div className="rounded-2xl border border-dashed border-black/10 bg-black/[0.02] px-4 py-6 text-sm text-[var(--text-secondary)]">
                    邮箱验证后才可查看远端 recurring 订阅列表。
                  </div>
                ) : isLoading ? (
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
                            {getSubscriptionAmount(subscription)} /{" "}
                            {subscription.payment_frequency_interval.toLowerCase()}
                          </div>
                        </div>
                        <Badge
                          variant="secondary"
                          className="w-fit rounded-full bg-black/[0.06] px-3 py-1 text-xs font-medium text-[var(--text-secondary)]"
                        >
                          {subscription.status}
                        </Badge>
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
                  <CardTitle className="text-lg">远端支付记录</CardTitle>
                </div>
                <CardDescription>最近 20 条由 Dodo 返回的支付信息。</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4 py-5">
                {!canManageBilling ? (
                  <div className="rounded-2xl border border-dashed border-black/10 bg-black/[0.02] px-4 py-6 text-sm text-[var(--text-secondary)]">
                    邮箱验证后才可查看远端支付记录。
                  </div>
                ) : isLoading ? (
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
                        <Badge
                          variant="secondary"
                          className="rounded-full bg-black/[0.06] px-3 py-1 text-xs font-medium text-[var(--text-secondary)]"
                        >
                          {payment.status ?? "未知"}
                        </Badge>
                      </div>
                      <div className="mt-3 flex flex-col gap-2 text-sm text-[var(--text-secondary)]">
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
