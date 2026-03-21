"use client";

import { useEffect, useState } from "react";
import type { ReplySuggestion } from "@/lib/api";

interface ReplySuggestionsBarProps {
    suggestions: ReplySuggestion[];
    onSelect: (text: string) => void;
}

export default function ReplySuggestionsBar({ suggestions, onSelect }: ReplySuggestionsBarProps) {
    if (!suggestions || suggestions.length === 0) return null;

    return (
        <div className="w-full px-0 mb-3">
            <div className="group/list flex w-full gap-2 hover:gap-0 transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] items-end">
                {suggestions.map((s, i) => (
                    <SuggestionCard key={`${s.type}-${i}`} suggestion={s} index={i} onSelect={onSelect} />
                ))}
            </div>
        </div>
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
