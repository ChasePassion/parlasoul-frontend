"use client";

import { useCallback, useEffect, useState } from "react";
import { getGrowthOverview } from "@/lib/growth-api";
import type { GrowthOverviewResponse } from "@/lib/growth-types";
import StatsOverviewChart from "@/components/growth/StatsOverviewChart";
import StatsOverviewSummary from "@/components/growth/StatsOverviewSummary";
import StatsOverviewRankings from "@/components/growth/StatsOverviewRankings";
import { Loader2 } from "lucide-react";
import { useSidebar } from "../layout";

export default function StatsPage() {
  const [data, setData] = useState<GrowthOverviewResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Close sidebar on mobile
  const { isSidebarOpen, closeSidebar, isOverlay } = useSidebar();
  useEffect(() => {
    if (isSidebarOpen && isOverlay) {
      closeSidebar();
    }
  }, [isSidebarOpen, isOverlay, closeSidebar]);

  const loadOverview = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await getGrowthOverview();
      setData(res);
    } catch (err) {
      console.error("Failed to fetch growth overview:", err);
      setError(err instanceof Error ? err : new Error("Unknown error"));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[var(--workspace-bg)]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center bg-[var(--workspace-bg)] p-6 text-center">
        <p className="text-rose-500 font-medium">数据加载失败。</p>
        <p className="mt-2 text-sm text-[var(--text-tertiary)]">
          {error?.message ?? "请稍后重试"}
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto bg-[var(--workspace-bg)] custom-scrollbar">
      <div className="mx-auto w-full max-w-5xl space-y-6 p-6 pb-20">
        <header>
          <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">
            数据总览
          </h1>
        </header>

        <section>
          <StatsOverviewChart data={data.trends.last_30_days} />
        </section>

        <section>
          <StatsOverviewSummary
            kpis={data.kpis}
            readingEquivalence={data.reading_equivalence}
          />
        </section>

        <section>
          <StatsOverviewRankings items={data.rankings.by_words} />
        </section>
      </div>
    </div>
  );
}
