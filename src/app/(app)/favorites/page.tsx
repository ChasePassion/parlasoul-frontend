"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { BookOpen, Loader2, MessageSquare, Zap } from "lucide-react";
import WorkspaceFrame from "@/components/layout/WorkspaceFrame";
import { useSidebar } from "../layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import FavoriteIcon from "@/components/ui/FavoriteIcon";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import type {
    FeedbackCard,
    ReplyCard,
    SavedItemKindPhase3,
    SavedItemResponsePhase3,
    WordCard,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import {
    useDeleteSavedItemMutation,
    useSavedItemsInfiniteQuery,
} from "@/lib/query";

type FavoriteTab = SavedItemKindPhase3;

interface FavoriteTabMeta {
    label: string;
    icon: typeof BookOpen;
    themeColor: string;
}

type Phrase = ReplyCard["key_phrases"][number] | FeedbackCard["key_phrases"][number];

const TAB_ORDER: FavoriteTab[] = ["word_card", "feedback_card", "reply_card"];

const TAB_META: Record<FavoriteTab, FavoriteTabMeta> = {
    word_card: {
        label: "单词卡",
        icon: BookOpen,
        themeColor: "#8A2BE2",
    },
    feedback_card: {
        label: "更好表达",
        icon: Zap,
        themeColor: "#20B2AA",
    },
    reply_card: {
        label: "回复卡",
        icon: MessageSquare,
        themeColor: "#4C83FF",
    },
};

const formatFavoriteDate = (value: string) =>
    new Intl.DateTimeFormat("zh-CN", {
        year: "numeric",
        month: "numeric",
        day: "numeric",
    }).format(new Date(value));

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const firstWordSense = (card: WordCard) =>
    card.pos_groups[0]?.senses[0]?.zh ?? "";

const readMetaString = (
    item: SavedItemResponsePhase3,
    keys: string[],
) => {
    const meta = item.source.meta;
    if (!meta || typeof meta !== "object") return "";

    for (const key of keys) {
        const value = meta[key];
        if (typeof value === "string" && value.trim()) {
            return value;
        }
    }

    return "";
};

function isWordCard(card: SavedItemResponsePhase3["card"]): card is WordCard {
    return "pos_groups" in card;
}

function hasKeyPhrases(
    card: SavedItemResponsePhase3["card"],
): card is ReplyCard | FeedbackCard {
    return "key_phrases" in card;
}

function HighlightedText({
    text,
    phrases,
    themeColor,
}: {
    text: string;
    phrases: string[];
    themeColor: string;
}) {
    const cleanPhrases = phrases.filter(Boolean);

    if (cleanPhrases.length === 0) {
        return <span>{text}</span>;
    }

    const regex = new RegExp(`(${cleanPhrases.map(escapeRegExp).join("|")})`, "gi");
    const parts = text.split(regex);

    return (
        <>
            {parts.map((part, index) => {
                const isMatch = cleanPhrases.some(
                    (phrase) => phrase.toLowerCase() === part.toLowerCase(),
                );

                if (!isMatch) {
                    return <span key={`${part}-${index}`}>{part}</span>;
                }

                return (
                    <span
                        key={`${part}-${index}`}
                        style={{
                            borderBottom: `2px dashed ${themeColor}`,
                            paddingBottom: "2px",
                        }}
                    >
                        {part}
                    </span>
                );
            })}
        </>
    );
}

function PhraseChip({
    phrase,
    themeColor,
}: {
    phrase: Phrase;
    themeColor: string;
}) {
    return (
        <Badge
            variant="outline"
            className="group inline-flex cursor-pointer items-center rounded-lg border-[#f3f4f6] bg-[#f9fafb] px-2.5 py-1.5 text-xs font-normal transition-colors hover:bg-[color-mix(in_srgb,var(--favorite-theme)_10%,white)]"
            style={{
                "--favorite-theme": themeColor,
            } as CSSProperties}
        >
            <span className="font-medium text-[#1f2937] group-hover:text-[var(--favorite-theme)]">
                {phrase.surface}
            </span>
            <span className="font-mono text-[#9ca3af]">{phrase.ipa_us}</span>
            <span className="mx-1.5 inline-block h-3 border-l border-[#d1d5db]" />
            <span className="text-[#4b5563]">{phrase.zh}</span>
        </Badge>
    );
}

function WordDetail({ item }: { item: SavedItemResponsePhase3 }) {
    if (!isWordCard(item.card)) return null;

    return (
        <>
            <div className="flex flex-wrap items-baseline gap-3">
                <h2 className="text-[28px] leading-tight tracking-normal text-[#333333]">
                    {item.card.surface}
                </h2>
                {item.card.ipa_us ? (
                    <span className="font-mono text-sm text-[#888888]">
                        {item.card.ipa_us}
                    </span>
                ) : null}
            </div>

            <div className="mt-4 flex flex-col gap-2">
                {item.card.pos_groups.map((group, groupIndex) => (
                    <div
                        key={`${group.pos}-${groupIndex}`}
                        className="flex items-center gap-2"
                    >
                        <Badge
                            variant="outline"
                            className="h-5 rounded border-[#8A2BE2] bg-transparent px-1 text-xs font-medium text-[#8A2BE2]"
                        >
                            {group.pos}
                        </Badge>
                        <div className="flex flex-col gap-1">
                            {group.senses.map((sense, senseIndex) => (
                                <p
                                    key={`${sense.zh}-${senseIndex}`}
                                    className="text-sm text-[#333333]"
                                >
                                    {sense.zh}
                                    {sense.note ? (
                                        <span className="ml-2 text-[#888888]">
                                            ({sense.note})
                                        </span>
                                    ) : null}
                                </p>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            <div className="relative mt-5 rounded-xl border border-[#EAEAEA] bg-[#F8F9FA] p-4">
                <p className="relative z-10 text-sm font-medium leading-relaxed text-[#333333]">
                    {item.card.example.surface}
                </p>
                <p className="relative z-10 mt-1.5 text-xs text-[#888888]">
                    {item.card.example.zh}
                </p>
            </div>
        </>
    );
}

function FeedbackDetail({ item }: { item: SavedItemResponsePhase3 }) {
    if (!hasKeyPhrases(item.card)) return null;

    const original =
        readMetaString(item, [
            "original_content",
            "original",
            "source_content",
            "user_content",
        ]) || item.display.surface;
    const phrases = item.card.key_phrases.map((phrase) => phrase.surface);
    const themeColor = TAB_META.feedback_card.themeColor;

    return (
        <>
            <div className="flex flex-col gap-5">
                <div className="rounded-lg border border-[#fecaca] bg-[#FFF4F4] p-4">
                    <span className="mb-1.5 block text-xs font-semibold text-[#ef4444]">
                        原句
                    </span>
                    <p className="text-sm text-[#FF4D4F]">{original}</p>
                </div>

                <div className="flex flex-col gap-2">
                    <p className="text-lg leading-relaxed text-[#333333]">
                        <HighlightedText
                            text={item.card.surface}
                            phrases={phrases}
                            themeColor={themeColor}
                        />
                    </p>
                    <p className="text-sm leading-relaxed text-[#888888]">
                        {item.card.zh}
                    </p>
                </div>
            </div>

            <footer className="mt-6 border-t border-[#EAEAEA] pt-4">
                <div className="flex flex-wrap gap-2">
                    {item.card.key_phrases.map((phrase) => (
                        <PhraseChip
                            key={`${phrase.surface}-${phrase.ipa_us}`}
                            phrase={phrase}
                            themeColor={themeColor}
                        />
                    ))}
                </div>
            </footer>
        </>
    );
}

function ReplyDetail({ item }: { item: SavedItemResponsePhase3 }) {
    if (!hasKeyPhrases(item.card)) return null;

    const phrases = item.card.key_phrases.map((phrase) => phrase.surface);
    const themeColor = TAB_META.reply_card.themeColor;

    return (
        <>
            <div className="flex flex-col gap-4">
                <p className="text-lg leading-relaxed text-[#333333]">
                    <HighlightedText
                        text={item.card.surface}
                        phrases={phrases}
                        themeColor={themeColor}
                    />
                </p>
                <p className="border-t border-[#EAEAEA] pt-4 text-sm leading-relaxed text-[#888888]">
                    {item.card.zh}
                </p>
            </div>

            <footer className="mt-6 border-t border-[#EAEAEA] pt-4">
                <div className="flex flex-wrap gap-2">
                    {item.card.key_phrases.map((phrase) => (
                        <PhraseChip
                            key={`${phrase.surface}-${phrase.ipa_us}`}
                            phrase={phrase}
                            themeColor={themeColor}
                        />
                    ))}
                </div>
            </footer>
        </>
    );
}

function FavoriteDetail({
    item,
    tab,
}: {
    item: SavedItemResponsePhase3;
    tab: FavoriteTab;
}) {
    if (tab === "word_card") {
        return <WordDetail item={item} />;
    }

    if (tab === "feedback_card") {
        return <FeedbackDetail item={item} />;
    }

    return <ReplyDetail item={item} />;
}

function getItemSummary(item: SavedItemResponsePhase3) {
    if (item.kind === "word_card" && isWordCard(item.card)) {
        return `${item.card.surface} ${item.card.ipa_us} — ${firstWordSense(item.card)}`;
    }

    if (item.kind === "feedback_card") {
        return (
            readMetaString(item, [
                "original_content",
                "original",
                "source_content",
                "user_content",
            ]) || item.display.surface
        );
    }

    return item.display.surface;
}

function FavoriteListItem({
    item,
    selected,
    tab,
    onSelect,
    onDelete,
    isDeleting,
}: {
    item: SavedItemResponsePhase3;
    selected: boolean;
    tab: FavoriteTab;
    onSelect: () => void;
    onDelete: () => void;
    isDeleting: boolean;
}) {
    const meta = TAB_META[tab];

    return (
        <div
            role="button"
            tabIndex={0}
            onClick={onSelect}
            onKeyDown={(event) => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                onSelect();
            }}
            className={cn(
                "block w-full rounded-xl border bg-white p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                selected
                    ? "border-[var(--favorite-theme)] bg-[color-mix(in_srgb,var(--favorite-theme)_5%,white)]"
                    : "border-transparent hover:border-[#EAEAEA] hover:bg-black/5 hover:shadow-sm",
            )}
            style={{
                "--favorite-theme": meta.themeColor,
            } as CSSProperties}
        >
            <p className="line-clamp-2 text-sm leading-relaxed text-[#333333]">
                {getItemSummary(item)}
            </p>
            <div className="mt-2 flex items-center justify-between gap-3">
                <span className="block text-xs text-[#888888]">
                    {formatFavoriteDate(item.created_at)}
                </span>
                <TooltipProvider delayDuration={300}>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <button
                                type="button"
                                aria-label="取消收藏"
                                disabled={isDeleting}
                                onClick={(event) => {
                                    event.stopPropagation();
                                    onDelete();
                                }}
                                className={cn(
                                    "rounded-md p-0.5 transition-colors hover:bg-gray-100",
                                    isDeleting && "opacity-50",
                                )}
                            >
                                <FavoriteIcon isFavorited size={18} />
                            </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" sideOffset={6}>
                            取消收藏
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </div>
        </div>
    );
}

function DetailSkeleton() {
    return (
        <div className="flex flex-col gap-4">
            <div className="h-9 w-40 rounded-lg bg-[#F2F4F7]" />
            <div className="h-4 w-56 rounded bg-[#F2F4F7]" />
            <div className="mt-2 h-24 rounded-xl border border-[#EAEAEA] bg-[#F8F9FA]" />
        </div>
    );
}

function EmptyDetail({ label }: { label: string }) {
    return (
        <div className="flex min-h-[180px] flex-col justify-center gap-2 text-center">
            <p className="text-base font-medium text-[#333333]">暂无{label}</p>
            <p className="text-sm text-[#888888]">你收藏的内容会显示在这里。</p>
        </div>
    );
}

export default function FavoritesPage() {
    const { user } = useAuth();
    const { setSelectedCharacterId } = useSidebar();
    const [currentTab, setCurrentTab] = useState<FavoriteTab>("word_card");
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const wordQuery = useSavedItemsInfiniteQuery(user?.id, {
        kind: "word_card",
        limit: 20,
    });
    const feedbackQuery = useSavedItemsInfiniteQuery(user?.id, {
        kind: "feedback_card",
        limit: 20,
    });
    const replyQuery = useSavedItemsInfiniteQuery(user?.id, {
        kind: "reply_card",
        limit: 20,
    });
    const deleteFavoriteMutation = useDeleteSavedItemMutation(user?.id);

    const itemsByTab = useMemo(
        () => ({
            word_card: wordQuery.data?.pages.flatMap((page) => page.items) ?? [],
            feedback_card:
                feedbackQuery.data?.pages.flatMap((page) => page.items) ?? [],
            reply_card: replyQuery.data?.pages.flatMap((page) => page.items) ?? [],
        }),
        [feedbackQuery.data, replyQuery.data, wordQuery.data],
    );

    const queryByTab = {
        word_card: wordQuery,
        feedback_card: feedbackQuery,
        reply_card: replyQuery,
    };

    const currentItems = itemsByTab[currentTab];
    const currentQuery = queryByTab[currentTab];
    const currentMeta = TAB_META[currentTab];
    const selectedItem = currentItems[selectedIndex] ?? currentItems[0] ?? null;
    const isInitialLoading = currentQuery.isLoading && currentItems.length === 0;

    useEffect(() => {
        setSelectedCharacterId(null);
    }, [setSelectedCharacterId]);

    useEffect(() => {
        if (selectedIndex === 0) return;
        if (selectedIndex < currentItems.length) return;
        setSelectedIndex(0);
    }, [currentItems.length, selectedIndex]);

    const handleDeleteFavorite = useCallback(async (id: string) => {
        setDeletingId(id);
        try {
            await deleteFavoriteMutation.mutateAsync(id);
        } catch (err) {
            console.error("Failed to delete favorite:", err);
        } finally {
            setDeletingId(null);
        }
    }, [deleteFavoriteMutation]);

    let detailContent: ReactNode = null;

    if (isInitialLoading) {
        detailContent = <DetailSkeleton />;
    } else if (selectedItem) {
        detailContent = <FavoriteDetail item={selectedItem} tab={currentTab} />;
    } else {
        detailContent = <EmptyDetail label={currentMeta.label} />;
    }

    return (
        <WorkspaceFrame className="bg-[#F7F9FA]">
            <div className="flex-1 overflow-y-auto bg-[#F7F9FA] text-[#333333] antialiased">
                <header className="mx-auto max-w-7xl px-6 pt-10 pb-8">
                    <h1 className="text-[28px] leading-tight tracking-normal text-[#333333]">
                        收藏夹
                    </h1>
                </header>

                <Tabs
                    value={currentTab}
                    onValueChange={(value) => {
                        setCurrentTab(value as FavoriteTab);
                        setSelectedIndex(0);
                    }}
                    className="mx-auto max-w-7xl px-6"
                >
                    <TabsList variant="line" className="flex h-auto gap-4 p-0">
                        {TAB_ORDER.map((tab) => {
                            const meta = TAB_META[tab];
                            const Icon = meta.icon;

                            return (
                                <TabsTrigger
                                    key={tab}
                                    value={tab}
                                    className="h-auto flex-none rounded-[12px] border border-transparent bg-transparent px-4 py-2 text-sm font-medium text-[#333333] shadow-none transition-all hover:bg-black/5 data-[state=active]:border-[var(--favorite-theme)] data-[state=active]:bg-white data-[state=active]:text-[var(--favorite-theme)] data-[state=active]:shadow-sm after:hidden"
                                    style={{
                                        "--favorite-theme": meta.themeColor,
                                    } as CSSProperties}
                                >
                                    <Icon data-icon="inline-start" />
                                    {meta.label}
                                </TabsTrigger>
                            );
                        })}
                    </TabsList>
                </Tabs>

                <section className="mx-auto max-w-7xl px-6 py-8 pb-20">
                    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
                        <Card className="gap-0 rounded-2xl border-[#EAEAEA] bg-white py-0 shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
                            <CardContent className="p-8">{detailContent}</CardContent>
                        </Card>

                        <aside className="h-fit lg:sticky lg:top-6">
                            <div
                                aria-label={`收藏的${currentMeta.label}`}
                                className="max-h-[calc(100vh-256px)] overflow-y-auto pr-2 [scrollbar-color:#e5e7eb_transparent] [scrollbar-gutter:stable] [scrollbar-width:thin] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#e5e7eb] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar]:w-1.5"
                            >
                                <div className="flex flex-col gap-3">
                                    {isInitialLoading ? (
                                        Array.from({ length: 3 }).map((_, index) => (
                                            <div
                                                key={index}
                                                className="rounded-xl border border-transparent bg-white p-4"
                                            >
                                                <div className="h-4 w-full rounded bg-[#F2F4F7]" />
                                                <div className="mt-2 h-4 w-2/3 rounded bg-[#F2F4F7]" />
                                                <div className="mt-3 flex items-center justify-between">
                                                    <div className="h-3 w-16 rounded bg-[#F2F4F7]" />
                                                    <div className="size-6 rounded-lg bg-[#F2F4F7]" />
                                                </div>
                                            </div>
                                        ))
                                    ) : currentItems.length > 0 ? (
                                        currentItems.map((item, index) => (
                                            <FavoriteListItem
                                                key={item.id}
                                                item={item}
                                                tab={currentTab}
                                                selected={index === selectedIndex}
                                                isDeleting={deletingId === item.id}
                                                onSelect={() => setSelectedIndex(index)}
                                                onDelete={() => {
                                                    void handleDeleteFavorite(item.id);
                                                }}
                                            />
                                        ))
                                    ) : (
                                        <div className="rounded-xl border border-transparent bg-white p-4 text-sm text-[#888888]">
                                            暂无{currentMeta.label}
                                        </div>
                                    )}

                                    {currentQuery.hasNextPage ? (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            className="h-10 rounded-xl text-sm text-[#888888] hover:bg-black/5"
                                            disabled={currentQuery.isFetchingNextPage}
                                            onClick={() => {
                                                void currentQuery.fetchNextPage();
                                            }}
                                        >
                                            {currentQuery.isFetchingNextPage ? (
                                                <>
                                                    <Loader2 data-icon="inline-start" className="animate-spin" />
                                                    加载中...
                                                </>
                                            ) : (
                                                "加载更多"
                                            )}
                                        </Button>
                                    ) : null}
                                </div>
                            </div>
                        </aside>
                    </div>
                </section>
            </div>
        </WorkspaceFrame>
    );
}
