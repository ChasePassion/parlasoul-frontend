"use client";

import { Suspense, useEffect } from "react";

import BillingPageContent from "@/components/billing/BillingPageContent";

import { useSidebar } from "../layout";

export default function BillingPage() {
  const { closeSidebar, isOverlay, isSidebarOpen, setSelectedCharacterId } = useSidebar();

  useEffect(() => {
    setSelectedCharacterId(null);
  }, [setSelectedCharacterId]);

  useEffect(() => {
    if (isSidebarOpen && isOverlay) {
      closeSidebar();
    }
  }, [closeSidebar, isOverlay, isSidebarOpen]);

  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center bg-[var(--workspace-bg)]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      }
    >
      <BillingPageContent />
    </Suspense>
  );
}
