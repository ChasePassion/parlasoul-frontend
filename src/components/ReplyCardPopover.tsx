"use client";

import type { ReplyCard } from "@/lib/api";
import CardPopoverShell from "@/components/ui/CardPopoverShell";
import {
    useOptimisticFavorite,
    type FavoriteToggleHandler,
} from "@/hooks/useOptimisticFavorite";
import { useDismissiblePopover } from "@/hooks/useDismissiblePopover";

interface ReplyCardPopoverProps {
    replyCard: ReplyCard;
    onToggleFavorite: FavoriteToggleHandler;
    onClose: () => void;
}

export default function ReplyCardPopover({
    replyCard,
    onToggleFavorite,
    onClose,
}: ReplyCardPopoverProps) {
    const popoverRef = useDismissiblePopover<HTMLDivElement>(onClose);
    const { isFavorited: localFavorited, handleToggleFavorite } =
        useOptimisticFavorite({
            isFavorited: replyCard.favorite.is_favorited,
            savedItemId: replyCard.favorite.saved_item_id ?? null,
            onToggleFavorite,
        });

    return (
        <CardPopoverShell
            ref={popoverRef}
            title="Reply Card"
            isFavorited={localFavorited}
            onToggleFavorite={handleToggleFavorite}
        >
            <p className="text-sm text-gray-700 leading-relaxed">
                {replyCard.zh}
            </p>

            {replyCard.key_phrases.length > 0 && (
                <div className="mt-4 pt-3 border-t border-gray-100">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                        Key Phrases
                    </p>
                    <div className="space-y-2">
                        {replyCard.key_phrases.map((kp, idx) => (
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
