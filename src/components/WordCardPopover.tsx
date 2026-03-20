"use client";

import type { WordCard } from "@/lib/api";
import CardPopoverShell from "@/components/ui/CardPopoverShell";
import {
    useOptimisticFavorite,
    type FavoriteToggleHandler,
} from "@/hooks/useOptimisticFavorite";
import { useDismissiblePopover } from "@/hooks/useDismissiblePopover";

interface WordCardPopoverProps {
    wordCard: WordCard;
    onToggleFavorite: FavoriteToggleHandler;
    isSaving?: boolean;
    onClose: () => void;
}

export default function WordCardPopover({
    wordCard,
    onToggleFavorite,
    isSaving = false,
    onClose,
}: WordCardPopoverProps) {
    const popoverRef = useDismissiblePopover<HTMLDivElement>(onClose);
    const { isFavorited: localFavorited, handleToggleFavorite } =
        useOptimisticFavorite({
            isFavorited: wordCard.favorite.is_favorited,
            savedItemId: wordCard.favorite.saved_item_id ?? null,
            isSaving,
            onToggleFavorite,
        });

    return (
        <CardPopoverShell
            ref={popoverRef}
            title="Word Card"
            isFavorited={localFavorited}
            isSaving={isSaving}
            onToggleFavorite={handleToggleFavorite}
        >
            <p className="text-lg font-bold text-gray-900 leading-relaxed">
                {wordCard.surface}
            </p>

            {wordCard.ipa_us && (
                <p className="mt-1 text-sm text-gray-400 font-mono">
                    {wordCard.ipa_us}
                </p>
            )}

            {wordCard.pos_groups.length > 0 && (
                <div className="mt-3 space-y-2">
                    {wordCard.pos_groups.map((group, idx) => (
                        <div key={idx}>
                            <span className="text-xs font-semibold text-gray-500">{group.pos}</span>
                            <div className="mt-1 space-y-1">
                                {group.senses.map((sense, sIdx) => (
                                    <p key={sIdx} className="text-sm text-gray-700">
                                        {sense.zh}
                                        {sense.note && (
                                            <span className="ml-1 text-xs text-gray-400">
                                                ({sense.note})
                                            </span>
                                        )}
                                    </p>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {wordCard.example && (
                <div className="mt-4 pt-3 border-t border-gray-100">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
                        Example
                    </p>
                    <p className="text-sm text-gray-800 leading-relaxed">
                        {wordCard.example.surface}
                    </p>
                    <p className="mt-1 text-sm text-gray-500 leading-relaxed">
                        {wordCard.example.zh}
                    </p>
                </div>
            )}
        </CardPopoverShell>
    );
}
