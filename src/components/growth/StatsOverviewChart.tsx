"use client";

import { useState } from "react";
import type { GrowthTrendBreakdownItem, GrowthTrendPoint } from "@/lib/growth-types";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { BarChart3, Check, ChevronDown } from "lucide-react";

type ChartMetric = "words" | "messages";

interface StatsOverviewChartProps {
  data: GrowthTrendPoint[];
}

interface RankedCharacter {
  id: string;
  name: string;
  color: string;
}

const CHART_COLORS = [
  "#f472b6",
  "#facc15",
  "#22d3ee",
  "#a78bfa",
  "#34d399",
  "#fb923c",
  "#60a5fa",
];

const OTHERS_COLOR = "#cbd5e1";
const OTHERS_KEY = "其他";
const TOP_CHARACTER_LIMIT = 7;

function getBreakdownMetricValue(
  item: GrowthTrendBreakdownItem,
  metric: ChartMetric,
): number {
  if (metric === "words") {
    return item.word_count;
  }

  return item.user_message_count ?? 0;
}

function getRankedCharacters(
  points: GrowthTrendPoint[],
  metric: ChartMetric,
): {
  topCharacters: RankedCharacter[];
  otherCharacterIds: Set<string>;
} {
  const totals = new Map<string, { id: string; name: string; value: number }>();

  for (const point of points) {
    for (const item of point.character_breakdown ?? []) {
      const value = getBreakdownMetricValue(item, metric);
      if (value <= 0) {
        continue;
      }

      const existing = totals.get(item.character_id);
      if (existing) {
        existing.value += value;
        continue;
      }

      totals.set(item.character_id, {
        id: item.character_id,
        name: item.character_name,
        value,
      });
    }
  }

  const ranked = [...totals.values()].sort((left, right) => {
    if (right.value !== left.value) {
      return right.value - left.value;
    }

    return left.name.localeCompare(right.name, "zh-CN");
  });

  return {
    topCharacters: ranked.slice(0, TOP_CHARACTER_LIMIT).map((item, index) => ({
      id: item.id,
      name: item.name,
      color: CHART_COLORS[index],
    })),
    otherCharacterIds: new Set(ranked.slice(TOP_CHARACTER_LIMIT).map((item) => item.id)),
  };
}

function buildChartRows(
  points: GrowthTrendPoint[],
  metric: ChartMetric,
  topCharacters: RankedCharacter[],
  otherCharacterIds: Set<string>,
) {
  return points.map((point) => {
    const row: Record<string, string | number> = {
      date: point.stat_date.slice(5, 10),
    };

    for (const item of topCharacters) {
      row[item.name] = 0;
    }

    row[OTHERS_KEY] = 0;

    for (const item of point.character_breakdown ?? []) {
      const value = getBreakdownMetricValue(item, metric);
      if (value <= 0) {
        continue;
      }

      const matchedCharacter = topCharacters.find(
        (character) => character.id === item.character_id,
      );

      if (matchedCharacter) {
        row[matchedCharacter.name] = Number(row[matchedCharacter.name] ?? 0) + value;
        continue;
      }

      if (otherCharacterIds.has(item.character_id)) {
        row[OTHERS_KEY] = Number(row[OTHERS_KEY] ?? 0) + value;
      }
    }

    return row;
  });
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ dataKey: string; value: number; fill: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  const items = payload
    .filter((item) => Number(item.value) > 0)
    .sort((left, right) => Number(right.value) - Number(left.value));

  if (!items.length) {
    return null;
  }

  const total = items.reduce((sum, item) => sum + Number(item.value), 0);

  return (
    <div className="min-w-[180px] rounded-2xl bg-white px-4 py-3 shadow-lg ring-1 ring-black/5">
      <p className="mb-2 text-sm font-semibold text-[var(--text-primary)]">
        {label}
      </p>
      <div className="space-y-1.5">
        {items.map((item) => (
          <div
            key={item.dataKey}
            className="flex items-center justify-between gap-4 text-xs"
          >
            <span className="flex items-center gap-2 text-[var(--text-secondary)]">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                style={{ backgroundColor: item.fill }}
              />
              <span>{item.dataKey}</span>
            </span>
            <span className="font-mono font-medium text-[var(--text-primary)]">
              {Number(item.value).toLocaleString()}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between border-t border-black/5 pt-2 text-xs font-semibold text-[var(--text-primary)]">
        <span>合计</span>
        <span>{total.toLocaleString()}</span>
      </div>
    </div>
  );
}

export default function StatsOverviewChart({
  data,
}: StatsOverviewChartProps) {
  const [metric, setMetric] = useState<ChartMetric>("words");

  const { topCharacters, otherCharacterIds } = getRankedCharacters(data, metric);
  const chartRows = buildChartRows(data, metric, topCharacters, otherCharacterIds);
  const legendItems = otherCharacterIds.size
    ? [...topCharacters, { id: OTHERS_KEY, name: OTHERS_KEY, color: OTHERS_COLOR }]
    : topCharacters;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-4 w-4 text-indigo-500" />
            {metric === "words" ? "每日词数分布" : "每日消息数分布"}
          </CardTitle>
          <p className="text-xs text-[var(--text-tertiary)]">
            最近 30 天按角色拆分的
            {metric === "words" ? "英文词数" : "消息数"}趋势
          </p>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-8 justify-start border-gray-200 bg-white text-xs shadow-none hover:border-gray-200 hover:bg-background focus-visible:!border-gray-200 focus-visible:ring-0 focus-visible:outline-none"
              style={{ width: 80 }}
            >
              {metric === "words" ? "词数" : "消息数"}
              <ChevronDown className="ml-auto h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={4} className="px-1 py-0.5">
            <DropdownMenuItem
              onClick={() => setMetric("words")}
              className={`my-0.5 flex items-center justify-between ${
                metric === "words" ? "bg-accent" : ""
              }`}
            >
              词数
              {metric === "words" ? <Check className="h-4 w-4" /> : null}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setMetric("messages")}
              className={`my-0.5 flex items-center justify-between ${
                metric === "messages" ? "bg-accent" : ""
              }`}
            >
              消息数
              {metric === "messages" ? <Check className="h-4 w-4" /> : null}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>

      <CardContent>
        {topCharacters.length > 0 ? (
          <>
            <div className="h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartRows}
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#e5e7eb"
                    opacity={0.55}
                  />
                  <XAxis
                    dataKey="date"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: "#9ca3af" }}
                    dy={6}
                    minTickGap={12}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: "#9ca3af" }}
                    width={40}
                  />
                  <Tooltip
                    content={<ChartTooltip />}
                    cursor={{ fill: "rgba(0, 0, 0, 0.03)" }}
                  />
                  {topCharacters.map((item) => (
                    <Bar
                      key={item.id}
                      dataKey={item.name}
                      stackId="growth-overview"
                      fill={item.color}
                    />
                  ))}
                  {otherCharacterIds.size ? (
                    <Bar
                      dataKey={OTHERS_KEY}
                      stackId="growth-overview"
                      fill={OTHERS_COLOR}
                    />
                  ) : null}
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-3">
              {legendItems.map((item) => (
                <span
                  key={item.id}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground"
                >
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  {item.name}
                </span>
              ))}
            </div>
          </>
        ) : (
          <div className="flex h-[320px] items-center justify-center text-sm text-[var(--text-tertiary)]">
            暂无角色互动数据
          </div>
        )}
      </CardContent>
    </Card>
  );
}
