"use client";

import { useEffect } from "react";
import StatsOverviewChart from "@/components/growth/StatsOverviewChart";
import StatsOverviewSummary from "@/components/growth/StatsOverviewSummary";
import StatsOverviewRankings from "@/components/growth/StatsOverviewRankings";
import { Loader2 } from "lucide-react";
import { useSidebar } from "../layout";
import { useAuth } from "@/lib/auth-context";
import { useGrowthOverviewQuery } from "@/lib/query";
import { useIsMobile } from "@/hooks/useIsMobile";
import { SpriteIcon } from "@/components/ui/sprite-icon";

export default function StatsPage() {
  const { user } = useAuth();
  const overviewQuery = useGrowthOverviewQuery(user?.id);
  const data = overviewQuery.data ?? null;
  const isMobile = useIsMobile();

  const { toggleSidebar, closeSidebar, isSidebarOpen, isOverlay } = useSidebar();
  useEffect(() => {
    if (isSidebarOpen && isOverlay) {
      closeSidebar();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (overviewQuery.isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[var(--workspace-bg)]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (overviewQuery.isError || !data) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center bg-[var(--workspace-bg)] p-6 text-center">
        <p className="text-rose-500 font-medium">数据加载失败。</p>
        <p className="mt-2 text-sm text-[var(--text-tertiary)]">
          {overviewQuery.error?.message ?? "请稍后重试"}
        </p>
      </div>
    );
  }

  const trendData = isMobile ? data.trends.last_7_days : data.trends.last_30_days;

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto bg-[var(--workspace-bg)] custom-scrollbar">
      {/* 移动端 Header */}
      <header className="md:hidden flex-none border-b border-divider bg-white">
        <div className="flex h-[52px] items-center gap-2 px-4">
          <button
            type="button"
            onClick={toggleSidebar}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-black hover:bg-sidebar-hover"
            aria-label="打开侧边栏"
          >
            <SpriteIcon name="sidebar" size={16} />
          </button>
          <h1 className="text-base font-semibold text-[var(--text-primary)]">
            数据总览
          </h1>
        </div>
      </header>

      <div className="mx-auto w-full max-w-5xl space-y-6 p-6 pb-20">
        <header className="hidden md:block">
          <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">
            数据总览
          </h1>
        </header>

        <section>
          <StatsOverviewChart
            data={trendData}
            dayCount={isMobile ? 7 : 30}
          />
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
