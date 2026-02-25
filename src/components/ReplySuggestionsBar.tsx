"use client";

import { useEffect, useRef, useState } from "react";
import type { ReplySuggestion } from "@/lib/api";

interface ReplySuggestionsBarProps {
    suggestions: ReplySuggestion[];
    onSelect: (text: string) => void;
}

export default function ReplySuggestionsBar({ suggestions, onSelect }: ReplySuggestionsBarProps) {
    if (!suggestions || suggestions.length === 0) return null;

    return (
        <div className="w-full px-0 mb-3">
            {/* group/list: monitors hover state across all cards */}
            <div className="group/list flex w-full gap-2 hover:gap-0 transition-all duration-400 ease-in-out items-end">
                {suggestions.map((s, i) => (
                    <SuggestionCard key={`${s.type}-${i}`} suggestion={s} index={i} onSelect={onSelect} />
                ))}
            </div>
        </div>
    );
}

/* ---- Individual card with fly-in animation ---- */
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
    const cardRef = useRef<HTMLDivElement>(null);

    // Trigger fly-in on mount with staggered delay
    useEffect(() => {
        const delay = index * 120; // 120ms stagger between cards
        const timer = setTimeout(() => setVisible(true), delay);
        return () => clearTimeout(timer);
    }, [index]);

    // Truncate for collapsed view
    const truncate = (text: string, max: number) =>
        text.length > max ? text.slice(0, max) + "..." : text;

    return (
        <div
            ref={cardRef}
            onClick={() => onSelect(suggestion.en)}
            className={`
                group/card relative flex-[1_1_0%] bg-white border border-gray-200 rounded-xl
                cursor-pointer overflow-hidden
                transition-all duration-400 ease-out
                max-h-[40px] hover:max-h-[150px]! hover:flex-[1_0_100%]!
                hover:opacity-100! hover:border-gray-300! hover:bg-gray-50 hover:shadow-md
                group-hover/list:flex-[0_0_0%] group-hover/list:opacity-0
                group-hover/list:border-transparent
                ${visible
                    ? "opacity-100 translate-x-0"
                    : "opacity-0 -translate-x-6"
                }
            `}
        >
            {/* Collapsed state: single-line truncated English */}
            <div className="absolute inset-x-0 top-0 h-[40px] flex items-center justify-center px-3 transition-opacity duration-200 group-hover/card:opacity-0">
                <span className="text-sm text-gray-600 font-medium truncate">
                    {truncate(suggestion.en, 30)}
                </span>
            </div>

            {/* Expanded state: bilingual detail */}
            <div className="opacity-0 group-hover/card:opacity-100 transition-opacity duration-300 p-3 w-full min-w-0 flex flex-col justify-center">
                <div className="text-sm font-bold text-gray-800 leading-snug wrap-break-word">
                    {suggestion.en}
                </div>
                <div className="h-px w-full bg-gray-200 my-2" />
                <div className="text-xs text-gray-500 wrap-break-word">{suggestion.zh}</div>
            </div>
        </div>
    );
}
