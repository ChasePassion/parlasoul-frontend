import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { redirect } from "next/navigation";

import PricingPageContent from "@/components/billing/PricingPageContent";
import { isBillingCheckoutDisabled } from "@/lib/billing-flags";
import { getPricingCatalog } from "@/lib/dodo-payments";

export const dynamic = "force-dynamic";

export default async function PricingPage() {
  if (isBillingCheckoutDisabled()) {
    redirect("/");
  }

  try {
    const catalog = await getPricingCatalog();
    return (
      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center bg-[var(--workspace-bg)]">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        }
      >
        <PricingPageContent catalog={catalog} />
      </Suspense>
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "价格信息暂时不可用，请稍后重试。";

    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--workspace-bg)] px-6">
        <div className="max-w-xl rounded-[28px] border border-rose-200 bg-white px-8 py-10 text-center shadow-[0_24px_70px_rgba(16,24,40,0.08)]">
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">定价页暂时不可用</h1>
          <p className="mt-4 text-sm leading-6 text-[var(--text-secondary)]">{message}</p>
        </div>
      </div>
    );
  }
}
