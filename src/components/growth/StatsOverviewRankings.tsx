"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { resolveCharacterAvatarSrc } from "@/lib/character-avatar";
import type { GrowthRankingItem } from "@/lib/growth-types";

interface StatsOverviewRankingsProps {
  items: GrowthRankingItem[];
}

export default function StatsOverviewRankings({
  items,
}: StatsOverviewRankingsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">角色排行</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length ? (
          <table className="w-full text-sm">
            <colgroup>
              <col className="w-[52%]" />
              <col className="w-[18%]" />
              <col className="w-[15%]" />
              <col className="w-[15%]" />
            </colgroup>
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th className="pb-2 pl-1 text-left font-medium">角色</th>
                <th className="pb-2 text-left font-medium">词数</th>
                <th className="pb-2 text-left font-medium">消息</th>
                <th className="pb-2 pr-1 text-right font-medium">天数</th>
              </tr>
            </thead>
            <tbody>
              {items.slice(0, 6).map((item) => (
                <tr
                  key={item.character_id}
                  className="border-b last:border-b-0"
                >
                  <td className="py-2.5 pl-1">
                    <div className="flex items-center gap-2.5">
                      <div className="h-7 w-7 shrink-0 overflow-hidden rounded-full bg-muted text-[10px] font-bold text-muted-foreground flex items-center justify-center">
                        {item.avatar_file_name ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={resolveCharacterAvatarSrc(item.avatar_file_name)}
                            alt={item.character_name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          item.character_name.slice(0, 1)
                        )}
                      </div>
                      <span className="truncate font-medium">
                        {item.character_name}
                      </span>
                    </div>
                  </td>
                  <td className="py-2.5 font-semibold tabular-nums">
                    {item.total_word_count.toLocaleString()}
                  </td>
                  <td className="py-2.5 tabular-nums text-muted-foreground">
                    {item.total_message_count}
                  </td>
                  <td className="py-2.5 pr-1 text-right tabular-nums text-muted-foreground">
                    {item.chatted_days_count}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="flex h-40 items-center justify-center text-sm text-[var(--text-tertiary)]">
            暂无排行数据
          </div>
        )}
      </CardContent>
    </Card>
  );
}
