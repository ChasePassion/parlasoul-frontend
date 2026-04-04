"use client";

import type { GrowthShareCard } from "@/lib/growth-types";

interface ShareCardRendererProps {
  card: GrowthShareCard;
}

export default function ShareCardRenderer({ card }: ShareCardRendererProps) {
  if (card.kind === "daily_signin_completed" && card.daily_signin_payload) {
    const p = card.daily_signin_payload;
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 px-8 py-10 text-white">
        {/* Brand */}
        <p className="text-xs font-medium uppercase tracking-widest text-white/60">
          NeuraChar
        </p>

        {/* Title */}
        <h3 className="text-center text-2xl font-bold leading-tight">
          {card.title}
        </h3>
        {card.subtitle && (
          <p className="text-sm text-white/80">{card.subtitle}</p>
        )}

        {/* Stats grid */}
        <div className="mt-2 grid grid-cols-2 gap-x-8 gap-y-3 text-center">
          <div>
            <p className="text-3xl font-bold">{p.current_natural_streak}</p>
            <p className="text-xs text-white/60">连签天数</p>
          </div>
          <div>
            <p className="text-3xl font-bold">{p.today_user_message_count}</p>
            <p className="text-xs text-white/60">今日消息</p>
          </div>
          <div>
            <p className="text-3xl font-bold">
              {p.today_total_word_count.toLocaleString()}
            </p>
            <p className="text-xs text-white/60">今日词数</p>
          </div>
          <div>
            <p className="text-3xl font-bold">
              {p.reading_equivalent.cet4_equivalent}
            </p>
            <p className="text-xs text-white/60">四级篇数</p>
          </div>
        </div>

        {/* Date */}
        <p className="mt-4 text-xs text-white/40">{p.stat_date}</p>
      </div>
    );
  }

  if (
    card.kind === "character_message_milestone" &&
    card.character_milestone_payload
  ) {
    const p = card.character_milestone_payload;
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600 px-8 py-10 text-white">
        {/* Brand */}
        <p className="text-xs font-medium uppercase tracking-widest text-white/60">
          NeuraChar
        </p>

        {/* Character name */}
        <p className="text-sm font-medium text-white/80">
          {p.character_name}
        </p>

        {/* Title */}
        <h3 className="text-center text-2xl font-bold leading-tight">
          {card.title}
        </h3>
        {card.subtitle && (
          <p className="text-sm text-white/80">{card.subtitle}</p>
        )}

        {/* Milestone stat */}
        <div className="mt-2 text-center">
          <p className="text-5xl font-bold">
            {p.milestone_message_count.toLocaleString()}
          </p>
          <p className="text-sm text-white/60">累计消息</p>
        </div>

        {/* Additional stats */}
        <div className="mt-2 grid grid-cols-3 gap-x-6 gap-y-2 text-center">
          <div>
            <p className="text-lg font-bold">
              {p.total_word_count.toLocaleString()}
            </p>
            <p className="text-[10px] text-white/60">词数</p>
          </div>
          <div>
            <p className="text-lg font-bold">{p.chatted_days_count}</p>
            <p className="text-[10px] text-white/60">天数</p>
          </div>
          <div>
            <p className="text-lg font-bold">{p.total_exchange_count}</p>
            <p className="text-[10px] text-white/60">往来</p>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
