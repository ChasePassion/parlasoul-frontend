"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SentenceCard } from "@/lib/api";

interface SentenceCardPopoverProps {
    sentenceCard: SentenceCard;
    onToggleFavorite: (
        isFavorited: boolean,
        savedItemId?: string | null
    ) => Promise<string | null> | string | null | void;
    isSaving?: boolean;
    onClose: () => void;
}

export default function SentenceCardPopover({
    sentenceCard,
    onToggleFavorite,
    isSaving = false,
    onClose,
}: SentenceCardPopoverProps) {
    const popoverRef = useRef<HTMLDivElement>(null);
    const [localFavorited, setLocalFavorited] = useState(sentenceCard.favorite.is_favorited);
    const [localSavedItemId, setLocalSavedItemId] = useState<string | null>(
        sentenceCard.favorite.saved_item_id ?? null
    );

    // Sync external state
    useEffect(() => {
        setLocalFavorited(sentenceCard.favorite.is_favorited);
        setLocalSavedItemId(sentenceCard.favorite.saved_item_id ?? null);
    }, [sentenceCard.favorite.is_favorited, sentenceCard.favorite.saved_item_id]);

    // Close on click outside
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
                onClose();
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [onClose]);

    // Close on Escape key
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        document.addEventListener("keydown", handler);
        return () => document.removeEventListener("keydown", handler);
    }, [onClose]);

    const handleToggleFavorite = useCallback(async () => {
        if (isSaving) return;
        const previousFavorited = localFavorited;
        const previousSavedItemId = localSavedItemId;
        const next = !localFavorited;
        setLocalFavorited(next); // Optimistic update
        if (!next) {
            setLocalSavedItemId(null);
        }

        try {
            const result = await onToggleFavorite(next, localSavedItemId ?? sentenceCard.favorite.saved_item_id);
            if (next) {
                setLocalSavedItemId(typeof result === "string" ? result : previousSavedItemId);
            } else {
                setLocalSavedItemId(null);
            }
        } catch {
            setLocalFavorited(previousFavorited);
            setLocalSavedItemId(previousSavedItemId);
        }
    }, [isSaving, localFavorited, localSavedItemId, onToggleFavorite, sentenceCard.favorite.saved_item_id]);

    return (
        <div
            ref={popoverRef}
            className="w-80 bg-white rounded-2xl border border-gray-200 shadow-xl p-5 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200"
        >
            {/* Header: Close + Favorite */}
            <div className="flex items-start justify-between mb-3">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Knowledge Card
                </h3>
                <button
                    type="button"
                    onClick={handleToggleFavorite}
                    disabled={isSaving}
                    className="p-1 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
                    aria-label={localFavorited ? "取消收藏" : "收藏"}
                >
                    <svg
                        className="w-5 h-5 transition-colors"
                        viewBox="0 0 1024 1024"
                    >
                        {localFavorited ? (
                            <path
                                d="M512 128a24.901818 24.901818 0 0 0-23.272727 13.730909l-82.385455 165.469091a94.72 94.72 0 0 1-71.447273 51.432727l-186.181818 26.530909a23.272727 23.272727 0 0 0-20.48 16.989091 23.272727 23.272727 0 0 0 6.283637 23.272728l134.050909 128.698181a93.090909 93.090909 0 0 1 27.461818 83.781819l-30.72 182.923636a23.272727 23.272727 0 0 0 9.774545 23.272727 25.134545 25.134545 0 0 0 27.229091 2.094546l165.701818-85.876364a96.116364 96.116364 0 0 1 87.97091 0l165.46909 86.109091a25.134545 25.134545 0 0 0 27.229091-2.094546 23.272727 23.272727 0 0 0 9.774546-23.272727l-31.650909-181.76a93.090909 93.090909 0 0 1 27.461818-83.781818l134.050909-128.698182a23.272727 23.272727 0 0 0 6.283636-23.272727 23.272727 23.272727 0 0 0-20.48-16.989091l-186.181818-26.530909a94.72 94.72 0 0 1-71.447273-51.432727L535.272727 141.730909a24.901818 24.901818 0 0 0-23.272727-13.730909z"
                                className="fill-yellow-500"
                            />
                        ) : (
                            <path
                                d="M290.210909 919.272727a94.952727 94.952727 0 0 1-56.32-18.618182 93.090909 93.090909 0 0 1-37.236364-93.090909L228.305455 628.363636a23.272727 23.272727 0 0 0-7.214546-23.272727l-133.818182-128a93.090909 93.090909 0 0 1-23.272727-96.349091A93.090909 93.090909 0 0 1 139.636364 316.043636l186.181818-26.530909a25.367273 25.367273 0 0 0 19.083636-13.498182l82.850909-165.46909a95.418182 95.418182 0 0 1 170.356364 0l82.850909 165.46909a25.367273 25.367273 0 0 0 19.083636 13.498182l186.181819 26.530909a93.090909 93.090909 0 0 1 77.032727 64.698182 93.090909 93.090909 0 0 1-23.272727 96.349091L802.909091 605.090909a23.272727 23.272727 0 0 0-7.214546 21.410909l31.65091 181.527273a93.090909 93.090909 0 0 1-37.236364 93.090909 94.72 94.72 0 0 1-100.538182 7.68l-165.701818-85.643636a25.134545 25.134545 0 0 0-23.272727 0L334.429091 907.636364a96.349091 96.349091 0 0 1-44.218182 11.636363zM512 128a24.901818 24.901818 0 0 0-23.272727 13.730909l-82.385455 165.469091a94.72 94.72 0 0 1-71.447273 51.432727l-186.181818 26.530909a23.272727 23.272727 0 0 0-20.48 16.989091 23.272727 23.272727 0 0 0 6.283637 23.272728l134.050909 128.698181a93.090909 93.090909 0 0 1 27.461818 83.781819l-30.72 182.923636a23.272727 23.272727 0 0 0 9.774545 23.272727 25.134545 25.134545 0 0 0 27.229091 2.094546l165.701818-85.876364a96.116364 96.116364 0 0 1 87.97091 0l165.46909 86.109091a25.134545 25.134545 0 0 0 27.229091-2.094546 23.272727 23.272727 0 0 0 9.774546-23.272727l-31.650909-181.76a93.090909 93.090909 0 0 1 27.461818-83.781818l134.050909-128.698182a23.272727 23.272727 0 0 0 6.283636-23.272727 23.272727 23.272727 0 0 0-20.48-16.989091l-186.181818-26.530909a94.72 94.72 0 0 1-71.447273-51.432727L535.272727 141.730909a24.901818 24.901818 0 0 0-23.272727-13.730909z"
                                className="fill-gray-400"
                            />
                        )}
                    </svg>
                </button>
            </div>

            {/* Surface: English original */}
            <p className="text-sm font-semibold text-gray-900 leading-relaxed">
                {sentenceCard.surface}
            </p>

            {/* Chinese translation */}
            <p className="mt-1.5 text-sm text-gray-500 leading-relaxed">
                {sentenceCard.zh}
            </p>

            {/* Key Phrases */}
            {sentenceCard.key_phrases.length > 0 && (
                <div className="mt-4 pt-3 border-t border-gray-100">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                        Key Phrases
                    </p>
                    <div className="space-y-2">
                        {sentenceCard.key_phrases.map((kp, idx) => (
                            <div key={idx} className="flex flex-col gap-0.5">
                                <div className="flex items-baseline gap-2">
                                    <span className="text-sm font-medium text-gray-800">
                                        {kp.surface}
                                    </span>
                                    <span className="text-xs text-gray-400 font-mono">
                                        {kp.ipa_us}
                                    </span>
                                </div>
                                <span className="text-xs text-gray-500">{kp.zh}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
