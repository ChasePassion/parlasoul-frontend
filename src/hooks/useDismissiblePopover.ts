"use client";

import { useEffect, useRef, type RefObject } from "react";

export function useDismissiblePopover<T extends HTMLElement>(
    onClose: () => void
): RefObject<T | null> {
    const popoverRef = useRef<T>(null);

    useEffect(() => {
        const handleMouseDown = (event: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
                onClose();
            }
        };

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                onClose();
            }
        };

        document.addEventListener("mousedown", handleMouseDown);
        document.addEventListener("keydown", handleKeyDown);

        return () => {
            document.removeEventListener("mousedown", handleMouseDown);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [onClose]);

    return popoverRef;
}
