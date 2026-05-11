"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { ReplySuggestion } from "@/lib/api";

interface ReplySuggestionsBarProps {
    suggestions: ReplySuggestion[];
    onSelect: (text: string) => void;
}

export default function ReplySuggestionsBar({ suggestions, onSelect }: ReplySuggestionsBarProps) {
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const mq = window.matchMedia("(max-width: 799px)");
        setIsMobile(mq.matches);
        const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
        mq.addEventListener("change", handler);
        return () => mq.removeEventListener("change", handler);
    }, []);

    if (!suggestions || suggestions.length === 0) return null;

    if (isMobile) {
        return <MobileSuggestions suggestions={suggestions} onSelect={onSelect} />;
    }

    return (
        <div className="w-full px-0 mb-3 pointer-events-auto">
            <div className="group/list flex w-full gap-2 hover:gap-0 transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] items-end">
                {suggestions.map((s, i) => (
                    <SuggestionCard key={`${s.type}-${i}`} suggestion={s} index={i} onSelect={onSelect} />
                ))}
            </div>
        </div>
    );
}

function MobileSuggestions({
    suggestions,
    onSelect,
}: {
    suggestions: ReplySuggestion[];
    onSelect: (text: string) => void;
}) {
    const [open, setOpen] = useState(false);

    return (
        <>
            <div className="w-full px-0 mb-3">
                <button
                    type="button"
                    onClick={() => setOpen(true)}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 bg-white shadow-sm text-sm text-gray-600 active:bg-gray-50 transition-colors pointer-events-auto"
                >
                    <span>回复建议</span>
                    <span className="ml-auto text-xs text-gray-400">{suggestions.length} 条</span>
                </button>
            </div>

            {open && (
                <div className="fixed inset-0 z-50 pointer-events-auto">
                    <div
                        className="absolute inset-0 bg-black/50 animate-in fade-in duration-200"
                        onClick={() => setOpen(false)}
                    />
                    <div className="absolute bottom-0 inset-x-0 bg-white rounded-t-2xl shadow-xl animate-in slide-in-from-bottom duration-300 max-h-[70vh] flex flex-col">
                        <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
                            <h3 className="text-sm font-semibold text-gray-900">回复建议</h3>
                            <button
                                type="button"
                                onClick={() => setOpen(false)}
                                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 transition-colors"
                                aria-label="关闭"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <div className="overflow-y-auto px-4 pb-6 flex flex-col gap-3">
                            {suggestions.map((s, i) => (
                                <button
                                    key={`${s.type}-${i}`}
                                    type="button"
                                    onClick={() => {
                                        onSelect(s.en);
                                        setOpen(false);
                                    }}
                                    className="text-left rounded-xl border border-gray-200 p-4 active:bg-blue-50 active:border-blue-300 transition-colors"
                                >
                                    <div className="text-sm font-semibold text-gray-900 leading-snug">
                                        {s.en}
                                    </div>
                                    <div className="mt-1.5 text-xs text-gray-500 leading-relaxed">
                                        {s.zh}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

function SuggestionCard({
    suggestion,
    index,
    onSelect,
}: {
    suggestion: ReplySuggestion;
    index: number;
    onSelect: (text: string) => void;
}) {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const delay = index * 120;
        const timer = setTimeout(() => setVisible(true), delay);
        return () => clearTimeout(timer);
    }, [index]);

    const truncate = (text: string, max: number) =>
        text.length > max ? text.slice(0, max) + "..." : text;

    return (
        <div
            onClick={() => onSelect(suggestion.en)}
            className={`
                group/card relative flex-[1_1_0%] min-h-[40px]
                suggestion-card backdrop-blur-sm
                rounded-2xl
                cursor-pointer overflow-hidden
                transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]
                group-hover/list:duration-1200 hover:duration-700!
                hover:flex-[1_0_100%]! hover:opacity-100!
                group-hover/list:flex-[0_0_0%] group-hover/list:opacity-0
                group-hover/list:border-transparent
                ${visible
                    ? "opacity-100 translate-x-0"
                    : "opacity-0 -translate-x-6"
                }
            `}
        >
            {/* 收缩态标题 — absolute 不占文档流，hover 时淡出 */}
            <div className="absolute inset-x-0 top-0 h-[40px] flex items-center justify-center px-3 z-10
                transition-opacity duration-200 group-hover/card:opacity-0 pointer-events-none">
                <span className="text-sm text-gray-600 font-medium truncate">
                    {truncate(suggestion.en, 30)}
                </span>
            </div>

            {/* 展开内容 — CSS Grid 0fr→1fr 平滑高度过渡，彻底消除跳动 */}
            <div className="grid grid-rows-[0fr] group-hover/card:grid-rows-[1fr]
                transition-[grid-template-rows] duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]">
                <div className="overflow-hidden min-h-0">
                    <div className="p-3 w-full min-w-0 flex flex-col justify-center
                        opacity-0 group-hover/card:opacity-100
                        transition-opacity duration-400 delay-150">
                        <div className="text-sm font-bold text-gray-800 leading-snug wrap-break-word">
                            {suggestion.en}
                        </div>
                        <div className="h-px w-full bg-linear-to-r from-transparent via-gray-200 to-transparent my-2" />
                        <div className="text-xs text-gray-500 wrap-break-word">{suggestion.zh}</div>
                    </div>
                </div>
            </div>
        </div>
    );
}
