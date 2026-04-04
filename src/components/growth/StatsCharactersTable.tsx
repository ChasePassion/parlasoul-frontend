"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { listGrowthCharacters } from "@/lib/growth-api";
import { resolveCharacterAvatarSrc } from "@/lib/character-avatar";
import type { GrowthCharacterRow, GrowthCharacterSortBy } from "@/lib/growth-types";
import { ArrowUpDown, Loader2 } from "lucide-react";

export default function StatsCharactersTable() {
  const [items, setItems] = useState<GrowthCharacterRow[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [sortBy, setSortBy] = useState<GrowthCharacterSortBy>("total_message_count");
  const latestQueryIdRef = useRef(0);
  const hasLoadedOnceRef = useRef(false);

  const fetchInitial = useCallback(async (sort: GrowthCharacterSortBy, isFirstLoad: boolean) => {
    const queryId = ++latestQueryIdRef.current;
    setIsLoadingMore(false);
    if (isFirstLoad) {
      setIsInitialLoading(true);
    } else {
      setIsRefreshing(true);
    }

    try {
      const res = await listGrowthCharacters({ limit: 20, sort_by: sort });
      if (latestQueryIdRef.current !== queryId) return;

      setItems(res.items);
      setNextCursor(res.next_cursor);
      setHasMore(res.has_more);
    } catch (err) {
      if (latestQueryIdRef.current !== queryId) return;
      console.error("Failed to fetch characters:", err);
    } finally {
      if (latestQueryIdRef.current !== queryId) return;

      hasLoadedOnceRef.current = true;
      setIsInitialLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (!nextCursor || isLoadingMore || isInitialLoading || isRefreshing) return;

    const queryId = latestQueryIdRef.current;
    setIsLoadingMore(true);

    try {
      const res = await listGrowthCharacters({ cursor: nextCursor, limit: 20, sort_by: sortBy });
      if (latestQueryIdRef.current !== queryId) return;

      setItems((prev) => [...prev, ...res.items]);
      setNextCursor(res.next_cursor);
      setHasMore(res.has_more);
    } catch (err) {
      if (latestQueryIdRef.current !== queryId) return;
      console.error("Failed to fetch more characters:", err);
    } finally {
      setIsLoadingMore(false);
    }
  }, [nextCursor, isLoadingMore, isInitialLoading, isRefreshing, sortBy]);

  useEffect(() => {
    void fetchInitial(sortBy, !hasLoadedOnceRef.current);
  }, [fetchInitial, sortBy]);

  const handleSort = (key: GrowthCharacterSortBy) => {
    if (sortBy === key) return; // For simplicity, just one-way sort (descending for all numerical, which backend handles)
    setSortBy(key);
  };

  const renderSortIcon = (key: GrowthCharacterSortBy) => {
    if (sortBy === key && isRefreshing) {
      return <Loader2 className="h-3 w-3 animate-spin" />;
    }

    return <ArrowUpDown className="h-3 w-3" />;
  };

  const getSortButtonClassName = (key: GrowthCharacterSortBy) =>
    `flex items-center gap-1.5 font-medium transition-colors ${
      sortBy === key
        ? "text-blue-600 hover:text-blue-600"
        : "hover:text-[var(--text-primary)]"
    }`;

  return (
    <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm" aria-busy={isRefreshing}>
          <thead className="border-b bg-[var(--workspace-bg)] text-[var(--text-secondary)]">
            <tr>
              <th className="px-6 py-3 font-medium">角色</th>
              <th className="px-6 py-3">
                <button
                  type="button"
                  onClick={() => handleSort("total_message_count")}
                  className={getSortButtonClassName("total_message_count")}
                >
                  消息数
                  {renderSortIcon("total_message_count")}
                </button>
              </th>
              <th className="px-6 py-3">
                <button
                  type="button"
                  onClick={() => handleSort("total_word_count")}
                  className={getSortButtonClassName("total_word_count")}
                >
                  词数
                  {renderSortIcon("total_word_count")}
                </button>
              </th>
              <th className="px-6 py-3 font-medium hidden sm:table-cell">天数</th>
              <th className="px-6 py-3 font-medium hidden md:table-cell">往来次数</th>
              <th className="px-6 py-3">
                <button
                  type="button"
                  onClick={() => handleSort("last_chat_at")}
                  className={getSortButtonClassName("last_chat_at")}
                >
                  最近聊天
                  {renderSortIcon("last_chat_at")}
                </button>
              </th>
            </tr>
          </thead>
          <tbody className={`divide-y text-[var(--text-primary)] transition-opacity ${isRefreshing ? "opacity-75" : "opacity-100"}`}>
            {isInitialLoading ? (
              <tr>
                <td colSpan={6} className="h-32 text-center text-[var(--text-tertiary)]">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    正在加载角色数据...
                  </div>
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={6} className="h-32 text-center text-[var(--text-tertiary)]">
                  暂无角色数据。
                </td>
              </tr>
            ) : (
              items.map((row) => (
                <tr key={row.character_id} className="hover:bg-[var(--workspace-bg)] transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8 rounded-md">
                        <AvatarImage src={resolveCharacterAvatarSrc(row.avatar_file_name)} />
                        <AvatarFallback className="rounded-md bg-blue-100 text-blue-700 text-[10px]">
                          {row.character_name.slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium max-w-[120px] truncate">{row.character_name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 tabular-nums">{row.total_message_count.toLocaleString()}</td>
                  <td className="px-6 py-4 tabular-nums">{row.total_word_count.toLocaleString()}</td>
                  <td className="px-6 py-4 tabular-nums hidden sm:table-cell">{row.chatted_days_count}</td>
                  <td className="px-6 py-4 tabular-nums hidden md:table-cell">{row.total_exchange_count}</td>
                  <td className="px-6 py-4 text-xs text-[var(--text-secondary)] whitespace-nowrap">
                    {row.last_chat_at ? new Date(row.last_chat_at).toLocaleDateString() : "-"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      
      {hasMore && !isInitialLoading && (
        <div className="border-t p-4 flex justify-center bg-[var(--workspace-bg)]">
          <Button
            type="button"
            variant="outline"
            onClick={() => void loadMore()}
            disabled={isLoadingMore || isRefreshing}
            className="rounded-xl w-full sm:w-auto"
          >
            {isLoadingMore && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isLoadingMore ? "加载中..." : "加载更多"}
          </Button>
        </div>
      )}
    </div>
  );
}
