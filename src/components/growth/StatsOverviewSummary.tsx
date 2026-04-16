"use client";

import {
  Card,
  CardContent,
} from "@/components/ui/card";
import type {
  GrowthKpis,
  GrowthReadingEquivalenceBlock,
} from "@/lib/growth-types";
import { BookOpen, Flame, Users } from "lucide-react";

interface StatsOverviewSummaryProps {
  kpis: GrowthKpis;
  readingEquivalence: GrowthReadingEquivalenceBlock;
}

export default function StatsOverviewSummary({
  kpis,
  readingEquivalence,
}: StatsOverviewSummaryProps) {
  return (
    <Card>
      <CardContent className="flex items-stretch py-0">
        <div className="flex flex-1 flex-col justify-center px-4">
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Flame className="h-4 w-4 text-amber-500" />
            连续签到
          </span>
          <p className="mt-1 text-2xl font-bold leading-tight text-[var(--text-primary)]">
            {kpis.current_natural_streak}
            <span className="ml-0.5 text-sm font-medium text-muted-foreground">
              天
            </span>
          </p>
          <p className="text-[11px] text-muted-foreground">
            最长 {kpis.longest_natural_streak} 天
          </p>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center px-4">
          <div className="text-left">
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <BookOpen className="h-4 w-4 text-emerald-500" />
              累计
            </span>
            <p className="mt-1 text-2xl font-bold leading-tight text-[var(--text-primary)]">
              {kpis.total_word_count.toLocaleString()}
              <span className="ml-0.5 text-sm font-medium text-muted-foreground">
                词
              </span>
            </p>
            <p className="text-[11px] text-muted-foreground">
              ≈ {readingEquivalence.global_history.cet4_equivalent} 篇四级 ·{" "}
              {readingEquivalence.global_history.cet6_equivalent} 篇六级
            </p>
          </div>
        </div>

        <div className="flex flex-1 flex-col items-end justify-center px-4">
          <div className="text-left">
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Users className="h-4 w-4 text-sky-400" />
              角色
            </span>
            <p className="mt-1 text-2xl font-bold leading-tight text-[var(--text-primary)]">
              {kpis.distinct_characters_chatted}
              <span className="ml-0.5 text-sm font-medium text-muted-foreground">
                个
              </span>
            </p>
            <p className="truncate text-[11px] text-muted-foreground">
              {kpis.top_character
                ? `最常聊: ${kpis.top_character.character_name}`
                : ""}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
