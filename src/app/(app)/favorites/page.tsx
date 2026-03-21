"use client";

import { useCallback, useEffect, useState } from "react";
import WorkspaceFrame from "@/components/layout/WorkspaceFrame";
import { useSidebar } from "../layout";
import {
    deleteSavedItem,
    listSavedItemsPhase3,
    type SavedItemKind,
    type SavedItemResponse,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

export default function FavoritesPage() {
    const { isAuthed } = useAuth();
    const { setSelectedCharacterId } = useSidebar();

    const [savedItems, setSavedItems] = useState<SavedItemResponse[]>([]);
    const [favoritesLoading, setFavoritesLoading] = useState(false);
    const [favoritesNextCursor, setFavoritesNextCursor] = useState<string | null>(null);
    const [favoritesHasMore, setFavoritesHasMore] = useState(false);

    useEffect(() => {
        setSelectedCharacterId(null);
    }, [setSelectedCharacterId]);

    const loadFavorites = useCallback(async (cursor?: string) => {
        if (!isAuthed) return;
        setFavoritesLoading(true);
        try {
            const page = await listSavedItemsPhase3({
                cursor: cursor ?? undefined,
                limit: 20,
            });
            if (cursor) {
                setSavedItems((prev) => [...prev, ...page.items]);
            } else {
                setSavedItems(page.items);
            }
            setFavoritesNextCursor(page.next_cursor ?? null);
            setFavoritesHasMore(page.has_more);
        } catch (err) {
            console.error("Failed to load favorites:", err);
        } finally {
            setFavoritesLoading(false);
        }
    }, [isAuthed]);

    useEffect(() => {
        void loadFavorites();
    }, [loadFavorites]);

    const handleDeleteFavorite = useCallback(async (id: string) => {
        const previous = savedItems;
        setSavedItems((prev) => prev.filter((item) => item.id !== id));
        try {
            await deleteSavedItem(id);
        } catch (err) {
            console.error("Failed to delete favorite:", err);
            setSavedItems(previous);
        }
    }, [savedItems]);

    const kindLabel: Record<SavedItemKind, string> = {
        reply_card: "回复卡",
        word_card: "单词卡",
        feedback_card: "更好表达",
    };

    const renderSavedItemBody = (item: SavedItemResponse) => {
        if (item.kind === "word_card" && "pos_groups" in item.card) {
            return (
                <div className="mt-3 pt-2 border-t border-gray-100">
                    <p className="text-xs text-gray-400 font-mono">{item.card.ipa_us}</p>
                    <p className="mt-2 text-sm text-gray-800 leading-relaxed">
                        {item.card.example.surface}
                    </p>
                    <p className="mt-1 text-sm text-gray-500">
                        {item.card.example.zh}
                    </p>
                </div>
            );
        }

        if ("key_phrases" in item.card && item.card.key_phrases.length > 0) {
            return (
                <div className="mt-3 pt-2 border-t border-gray-100">
                    <div className="flex flex-wrap gap-1.5">
                        {item.card.key_phrases.map((kp, idx) => (
                            <span
                                key={idx}
                                className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs text-blue-700"
                            >
                                {kp.surface}
                                <span className="text-blue-400 font-mono text-[10px]">{kp.ipa_us}</span>
                            </span>
                        ))}
                    </div>
                </div>
            );
        }

        return null;
    };

    return (
        <WorkspaceFrame>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
                <div className="mx-auto max-w-7xl">
                    <div className="mb-8">
                        <h1 className="text-3xl font-bold text-gray-900">收藏夹</h1>
                        <p className="mt-2 text-sm text-gray-500">你收藏的表达和卡片会显示在这里。</p>
                    </div>

                    {favoritesLoading && savedItems.length === 0 ? (
                        <div className="flex justify-center py-20">
                            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
                        </div>
                    ) : savedItems.length === 0 ? (
                        <div className="py-20 text-center text-gray-400">暂无收藏内容</div>
                    ) : (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {savedItems.map((item) => (
                                    <div
                                        key={item.id}
                                        className="group relative rounded-2xl border border-gray-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow"
                                    >
                                        <button
                                            type="button"
                                            onClick={() => {
                                                void handleDeleteFavorite(item.id);
                                            }}
                                            className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-red-500"
                                            aria-label="删除收藏"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>

                                        <p className="text-sm font-semibold text-gray-900 leading-relaxed pr-6">
                                            {item.display.surface}
                                        </p>
                                        <p className="mt-1 text-sm text-gray-500">
                                            {item.display.zh}
                                        </p>

                                        <p className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-gray-300">
                                            {kindLabel[item.kind]}
                                        </p>

                                        {renderSavedItemBody(item)}

                                        <p className="mt-2 text-[10px] text-gray-300">
                                            {new Date(item.created_at).toLocaleDateString("zh-CN")}
                                        </p>
                                    </div>
                                ))}
                            </div>

                            {favoritesHasMore && (
                                <div className="mt-6 flex justify-center">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (favoritesNextCursor) {
                                                void loadFavorites(favoritesNextCursor);
                                            }
                                        }}
                                        disabled={favoritesLoading}
                                        className="px-6 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors disabled:opacity-50"
                                    >
                                        {favoritesLoading ? "加载中..." : "加载更多"}
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </WorkspaceFrame>
    );
}
