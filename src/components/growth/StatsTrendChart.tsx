"use client";

import type { GrowthTrendPoint } from "@/lib/growth-types";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface StatsTrendChartProps {
  data: GrowthTrendPoint[];
  metric: "words" | "messages";
}

export default function StatsTrendChart({ data, metric }: StatsTrendChartProps) {
  const chartData = data.map((d) => ({
    date: d.stat_date.slice(5), // "MM-DD"
    value: metric === "words" ? d.total_word_count : d.total_message_count,
    isSignIn: d.is_natural_signed || d.is_makeup_signed,
  }));

  return (
    <div className="h-[300px] w-full pt-4">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
          <XAxis 
            dataKey="date" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fontSize: 12, fill: 'var(--text-tertiary)' }}
            dy={10}
            minTickGap={20}
          />
          <YAxis 
            axisLine={false} 
            tickLine={false} 
            tick={{ fontSize: 12, fill: 'var(--text-tertiary)' }}
            width={40}
          />
          <Tooltip
            contentStyle={{ 
              borderRadius: '8px', 
              border: '1px solid var(--border)',
              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
            }}
            itemStyle={{ color: 'var(--text-primary)', fontWeight: 500 }}
            labelStyle={{ color: 'var(--text-secondary)', marginBottom: '4px' }}
          />
          <Area
            type="monotone"
            dataKey="value"
            name={metric === "words" ? "词数" : "消息数"}
            stroke="#3b82f6"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorValue)"
            activeDot={{ r: 6, strokeWidth: 0, fill: '#2563eb' }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
