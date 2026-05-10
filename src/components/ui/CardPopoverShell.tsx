"use client";

import { forwardRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import FavoriteIcon from "@/components/ui/FavoriteIcon";

interface CardPopoverShellProps {
    title: string;
    isFavorited: boolean;
    onToggleFavorite: () => void;
    children: ReactNode;
    placement?: "top" | "bottom" | "left" | "right";
    mobileMode?: boolean;
}

const CardPopoverShell = forwardRef<HTMLDivElement, CardPopoverShellProps>(
    function CardPopoverShell(
        {
            title,
            isFavorited,
            onToggleFavorite,
            children,
            placement = "left",
            mobileMode = false,
        },
        ref
    ) {
        return (
            <div
                ref={ref}
                className={cn(
                    "rounded-2xl border border-gray-200 bg-white shadow-xl z-50 animate-in fade-in duration-200 overflow-hidden",
                    mobileMode
                        ? "w-[calc(100vw-32px)] max-w-80 slide-in-from-bottom-4"
                        : "w-[calc(100vw-24px)] max-w-80",
                    !mobileMode && placement === "top" && "slide-in-from-top-2",
                    !mobileMode && placement === "bottom" && "slide-in-from-bottom-2",
                    !mobileMode && placement === "left" && "slide-in-from-left-2",
                    !mobileMode && placement === "right" && "slide-in-from-right-2"
                )}
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
