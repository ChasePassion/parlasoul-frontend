"use client";

import { useCallback, useEffect, useState } from "react";

export type FavoriteToggleHandler = (
    isFavorited: boolean,
    savedItemId?: string | null
) => Promise<string | null> | string | null | void;

interface UseOptimisticFavoriteOptions {
    isFavorited: boolean;
    savedItemId?: string | null;
    onToggleFavorite: FavoriteToggleHandler;
}

export function useOptimisticFavorite({
    isFavorited,
    savedItemId,
    onToggleFavorite,
}: UseOptimisticFavoriteOptions) {
    const [localFavorited, setLocalFavorited] = useState(isFavorited);
    const [localSavedItemId, setLocalSavedItemId] = useState<string | null>(
        savedItemId ?? null
    );

    useEffect(() => {
        setLocalFavorited(isFavorited);
        setLocalSavedItemId(savedItemId ?? null);
    }, [isFavorited, savedItemId]);

    const handleToggleFavorite = useCallback(async () => {
        const previousFavorited = localFavorited;
        const previousSavedItemId = localSavedItemId;
        const next = !localFavorited;

        setLocalFavorited(next);
        if (!next) {
            setLocalSavedItemId(null);
        }

        try {
            const result = await onToggleFavorite(next, localSavedItemId ?? savedItemId);
            if (next) {
                setLocalSavedItemId(
                    typeof result === "string" ? result : previousSavedItemId
                );
            } else {
                setLocalSavedItemId(null);
            }
        } catch {
            setLocalFavorited(previousFavorited);
            setLocalSavedItemId(previousSavedItemId);
        }
    }, [localFavorited, localSavedItemId, onToggleFavorite, savedItemId]);

    return {
        isFavorited: localFavorited,
        handleToggleFavorite,
    };
}
