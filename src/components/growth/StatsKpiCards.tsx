"use client";

import { type GrowthKpis, type GrowthReadingEquivalenceBlock } from "@/lib/growth-types";
import { BookOpen, CalendarCheck, FileText, LucideIcon, Trophy, Users } from "lucide-react";

interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: { label: string; value: string; positive: boolean };
}

function KpiCard({ title, value, subtitle, icon: Icon, trend }: KpiCardProps) {
  return (
    <div className="flex flex-col rounded-xl border bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3 text-[var(--text-secondary)]">
        <Icon className="h-5 w-5 text-blue-500" />
        <span className="text-sm font-medium">{title}</span>
      </div>
      <div className="mt-4 flex items-end gap-3">
        <span className="text-3xl font-bold text-[var(--text-primary)]">
          {value}
        </span>
        {subtitle && (
          <span className="mb-1 text-xs text-[var(--text-tertiary)]">
            {subtitle}
          </span>
        )}
      </div>
      {trend && (
        <div className="mt-3 flex items-center gap-1.5 text-xs">
          <span
            className={`font-medium ${
              trend.positive ? "text-emerald-500" : "text-rose-500"
            }`}
          >
            {trend.value}
          </span>
          <span className="text-[var(--text-tertiary)]">{trend.label}</span>
        </div>
      )}
    </div>
  );
}

export function StatsKpiCards({ kpis }: { kpis: GrowthKpis }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <KpiCard
        title="当前连签"
        value={kpis.current_natural_streak}
        subtitle="天"
        icon={CalendarCheck}
        trend={{
          label: "历史最长",
          value: `${kpis.longest_natural_streak} 天`,
          positive: true,
        }}
      />
      <KpiCard
        title="今日词数"
        value={kpis.today_word_count.toLocaleString()}
        icon={FileText}
        trend={{
          label: "今日消息",
          value: `${kpis.today_message_count}`,
          positive: true,
        }}
      />
      <KpiCard
        title="历史总词数"
        value={kpis.total_word_count.toLocaleString()}
        subtitle="词"
        icon={BookOpen}
        trend={{
          label: "历史总消息",
          value: `${kpis.total_message_count.toLocaleString()}`,
          positive: true,
        }}
      />
      <KpiCard
        title="聊过角色"
        value={kpis.distinct_characters_chatted}
        subtitle="个"
        icon={Users}
        trend={
          kpis.top_character
            ? {
                label: `最多：${kpis.top_character.character_name}`,
                value: "★",
                positive: true,
              }
            : undefined
        }
      />
    </div>
  );
}

export function StatsReadingEquivalence({
  data,
  focusCharacterId,
}: {
  data: GrowthReadingEquivalenceBlock;
  focusCharacterId?: string;
}) {
  const target = focusCharacterId && data.focus_character ? data.focus_character_history : data.global_history;
  const todayTarget = focusCharacterId && data.focus_character ? data.focus_character_today : data.global_today;
  const title = focusCharacterId && data.focus_character ? `${data.focus_character.character_name} 的阅读等价` : "全局阅读等价";

  if (!target || !todayTarget) return null;

  return (
    <div className="rounded-xl border bg-gradient-to-br from-indigo-50 to-blue-50/50 p-6">
      <div className="flex items-center gap-2 text-indigo-900">
        <Trophy className="h-5 w-5" />
        <h3 className="font-semibold">{title}</h3>
      </div>
      <p className="mt-1 text-sm text-indigo-700/80">
        把聊天积累换算成阅读量，直观看到你的语言输入输出规模。
      </p>

      <div className="mt-6 grid grid-cols-2 gap-8">
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold text-indigo-600">
              {target.cet4_equivalent}
            </span>
            <span className="text-sm font-medium text-indigo-800">四级篇数</span>
          </div>
          <p className="mt-1 text-xs text-indigo-600/70">
            {todayTarget.cet4_equivalent > 0 ? `今日 +${todayTarget.cet4_equivalent}` : "今日暂无新增"}
          </p>
        </div>
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold text-blue-600">
              {target.cet6_equivalent}
            </span>
            <span className="text-sm font-medium text-blue-800">六级篇数</span>
          </div>
          <p className="mt-1 text-xs text-blue-600/70">
            {todayTarget.cet6_equivalent > 0 ? `今日 +${todayTarget.cet6_equivalent}` : "今日暂无新增"}
          </p>
        </div>
      </div>
    </div>
  );
}
