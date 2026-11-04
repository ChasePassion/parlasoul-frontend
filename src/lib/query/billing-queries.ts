import { useQuery } from "@tanstack/react-query";
import {
  getWechatPaymentOrder,
  getWechatPaymentProducts,
  listDodoPayments,
  listDodoSubscriptions,
  listWechatPaymentOrders,
} from "@/lib/api";
import { isBillingCheckoutEnabled } from "@/lib/billing-flags";
import { queryKeys } from "./query-keys";

export function useWechatPaymentProductsQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.billing.wechatProducts(),
    queryFn: ({ signal }) => getWechatPaymentProducts({ signal }),
    enabled: enabled && isBillingCheckoutEnabled(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useWechatPaymentOrderQuery(
  userId: string | null | undefined,
  orderId: string | null | undefined,
  enabled = true,
) {
  return useQuery({
    queryKey: queryKeys.billing.wechatOrder(userId, orderId),
    queryFn: ({ signal }) => getWechatPaymentOrder(orderId as string, { signal }),
    enabled: Boolean(userId && orderId) && enabled,
    staleTime: 15 * 1000,
  });
}

export function useWechatPaymentOrdersQuery(
  userId: string | null | undefined,
  params: { channel?: "wechat_pay"; skip?: number; limit?: number } = {},
  enabled = true,
) {
  return useQuery({
    queryKey: queryKeys.billing.wechatOrders(userId, params),
    queryFn: ({ signal }) => listWechatPaymentOrders(params, { signal }),
    enabled: Boolean(userId) && enabled,
  });
}

export function useDodoSubscriptionsQuery(
  userId: string | null | undefined,
  params: {
    page?: number;
    limit?: number;
    status?:
      | "pending"
      | "active"
      | "on_hold"
      | "cancelled"
      | "failed"
      | "expired";
  } = {},
  enabled = true,
) {
  return useQuery({
    queryKey: queryKeys.billing.dodoSubscriptions(userId, params),
    queryFn: () => listDodoSubscriptions(params),
    enabled: Boolean(userId) && enabled,
  });
}

export function useDodoPaymentsQuery(
  userId: string | null | undefined,
  params: {
    page?: number;
    limit?: number;
    status?:
      | "succeeded"
      | "failed"
      | "cancelled"
      | "processing"
      | "requires_customer_action"
      | "requires_merchant_action"
      | "requires_payment_method"
      | "requires_confirmation"
      | "requires_capture"
      | "partially_captured"
      | "partially_captured_and_capturable";
  } = {},
  enabled = true,
) {
  return useQuery({
    queryKey: queryKeys.billing.dodoPayments(userId, params),
    queryFn: () => listDodoPayments(params),
    enabled: Boolean(userId) && enabled,
  });
}
