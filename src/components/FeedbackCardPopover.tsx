"use client";

import type { FeedbackCard as FeedbackCardType } from "@/lib/api";
import CardPopoverShell from "@/components/ui/CardPopoverShell";
import {
    useOptimisticFavorite,
    type FavoriteToggleHandler,
} from "@/hooks/useOptimisticFavorite";
import { useDismissiblePopover } from "@/hooks/useDismissiblePopover";

interface FeedbackCardPopoverProps {
    feedbackCard: FeedbackCardType;
    onToggleFavorite: FavoriteToggleHandler;
    onClose: () => void;
}

export default function FeedbackCardPopover({
    feedbackCard,
    onToggleFavorite,
    onClose,
}: FeedbackCardPopoverProps) {
    const popoverRef = useDismissiblePopover<HTMLDivElement>(onClose);
    const { isFavorited: localFavorited, handleToggleFavorite } =
        useOptimisticFavorite({
            isFavorited: feedbackCard.favorite.is_favorited,
            savedItemId: feedbackCard.favorite.saved_item_id ?? null,
            onToggleFavorite,
        });

    return (
        <CardPopoverShell
            ref={popoverRef}
            title="Better Expression"
            isFavorited={localFavorited}
            onToggleFavorite={handleToggleFavorite}
        >
            <p className="text-sm font-semibold text-gray-900 leading-relaxed">
                {feedbackCard.surface}
            </p>

            <p className="mt-1.5 text-sm text-gray-500 leading-relaxed">
                {feedbackCard.zh}
            </p>

            {feedbackCard.key_phrases.length > 0 && (
                <div className="mt-4 pt-3 border-t border-gray-100">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                        Key Phrases
                    </p>
                    <div className="space-y-2">
                        {feedbackCard.key_phrases.map((kp, idx) => (
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
        </CardPopoverShell>
    );
}
