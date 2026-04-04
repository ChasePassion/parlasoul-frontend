"use client";

import { useEffect, useState } from "react";
import { getGrowthOverview } from "@/lib/growth-api";
import type { GrowthOverviewResponse } from "@/lib/growth-types";
import { StatsKpiCards, StatsReadingEquivalence } from "@/components/growth/StatsKpiCards";
import StatsTrendChart from "@/components/growth/StatsTrendChart";
import StatsCharactersTable from "@/components/growth/StatsCharactersTable";
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

  useEffect(() => {
    async function fetchOverview() {
      try {
        const res = await getGrowthOverview();
        setData(res);
      } catch (err) {
        console.error("Failed to fetch growth overview:", err);
        setError(err instanceof Error ? err : new Error("Unknown error"));
      } finally {
        setIsLoading(false);
      }
    }
    fetchOverview();
  }, []);

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
        <p className="text-sm text-[var(--text-tertiary)] mt-2">{error?.message ?? "请稍后重试"}</p>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col bg-[var(--workspace-bg)] overflow-y-auto custom-scrollbar">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-divider bg-white/80 px-6 py-4 backdrop-blur-xl">
        <h1 className="text-xl font-bold text-[var(--text-primary)] tracking-tight">
          我的战绩
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mt-0.5">
          查看你的对话积累、阅读等价与角色互动分布。
        </p>
      </div>

      <div className="flex-1 space-y-8 p-6 max-w-6xl mx-auto w-full pb-20">
        
        {/* Top KPIs */}
        <section>
          <StatsKpiCards kpis={data.kpis} />
        </section>

        {/* Level / Reading Equivalent Highlight */}
        <section>
          <StatsReadingEquivalence data={data.reading_equivalence} />
        </section>

        {/* Charts & Trends */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-xl border bg-white p-5 shadow-sm flex flex-col">
            <h3 className="font-semibold text-[var(--text-primary)] mb-1">词数（30 天）</h3>
            <p className="text-xs text-[var(--text-tertiary)] mb-4">最近 30 天英文词数趋势</p>
            <div className="flex-1 min-h-[300px]">
              <StatsTrendChart data={data.trends.last_30_days} metric="words" />
            </div>
          </div>
          
          <div className="rounded-xl border bg-white p-5 shadow-sm flex flex-col">
            <h3 className="font-semibold text-[var(--text-primary)] mb-1">消息数（30 天）</h3>
            <p className="text-xs text-[var(--text-tertiary)] mb-4">最近 30 天消息总量趋势</p>
            <div className="flex-1 min-h-[300px]">
              <StatsTrendChart data={data.trends.last_30_days} metric="messages" />
            </div>
          </div>
        </section>

        {/* Character Ledger */}
        <section>
          <div className="mb-4">
            <h2 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
              角色台账
            </h2>
            <p className="text-sm text-[var(--text-secondary)] mt-0.5">
              查看你和不同角色的历史互动数据。
            </p>
          </div>
          <StatsCharactersTable />
        </section>
        
      </div>
    </div>
  );
}
