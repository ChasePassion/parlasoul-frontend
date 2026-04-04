"use client";

import { forwardRef, type ReactNode } from "react";
import FavoriteIcon from "@/components/ui/FavoriteIcon";

interface CardPopoverShellProps {
    title: string;
    isFavorited: boolean;
    onToggleFavorite: () => void;
    children: ReactNode;
}

const CardPopoverShell = forwardRef<HTMLDivElement, CardPopoverShellProps>(
    function CardPopoverShell(
        {
            title,
            isFavorited,
            onToggleFavorite,
            children,
        },
        ref
    ) {
        return (
            <div
                ref={ref}
                className="w-[calc(100vw-24px)] max-w-80 rounded-2xl border border-gray-200 bg-white shadow-xl z-50 animate-in fade-in slide-in-from-bottom-2 duration-200 overflow-hidden"
            >
                <div className="px-5 pt-5 pb-3 flex items-start justify-between shrink-0">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                        {title}
                    </h3>
                    <button
                        type="button"
                        onClick={onToggleFavorite}
                        className="rounded-lg p-1 transition-colors hover:bg-gray-100"
                        aria-label={isFavorited ? "取消收藏" : "收藏"}
                    >
                        <FavoriteIcon isFavorited={isFavorited} />
                    </button>
                </div>

                <div className="px-5 pb-5 max-h-[70vh] overflow-y-auto scrollbar-thin">
                    {children}
                </div>
            </div>
        );
    }
);

export default CardPopoverShell;
