"use client";

import { useCallback, useLayoutEffect, useState, type RefObject } from "react";

export interface FloatingAnchorRect {
    top: number;
    right: number;
    bottom: number;
    left: number;
    width: number;
    height: number;
}

type FloatingPlacement = "left" | "right" | "top" | "bottom";

interface FloatingPosition {
    top: number;
    left: number;
}

interface UseFloatingPositionOptions {
    isOpen: boolean;
    overlayRef: RefObject<HTMLElement | null>;
    getAnchorRect: () => FloatingAnchorRect | null;
    preferredPlacement: FloatingPlacement;
    gap?: number;
    padding?: number;
}

function clamp(value: number, min: number, max: number) {
    if (max < min) return min;
    return Math.min(Math.max(value, min), max);
}

function getMainAxisSpace(
    placement: FloatingPlacement,
    anchorRect: FloatingAnchorRect,
    viewportWidth: number,
    viewportHeight: number,
    gap: number,
    padding: number
) {
    switch (placement) {
        case "left":
            return anchorRect.left - padding - gap;
        case "right":
            return viewportWidth - padding - anchorRect.right - gap;
        case "top":
            return anchorRect.top - padding - gap;
        case "bottom":
            return viewportHeight - padding - anchorRect.bottom - gap;
    }
}

function fitsPlacement(
    placement: FloatingPlacement,
    anchorRect: FloatingAnchorRect,
    overlayWidth: number,
    overlayHeight: number,
    viewportWidth: number,
    viewportHeight: number,
    gap: number,
    padding: number
) {
    switch (placement) {
        case "left":
            return anchorRect.left - gap - overlayWidth >= padding;
        case "right":
            return anchorRect.right + gap + overlayWidth <= viewportWidth - padding;
        case "top":
            return anchorRect.top - gap - overlayHeight >= padding;
        case "bottom":
            return anchorRect.bottom + gap + overlayHeight <= viewportHeight - padding;
    }
}

function resolvePlacement(
    preferredPlacement: FloatingPlacement,
    anchorRect: FloatingAnchorRect,
    overlayWidth: number,
    overlayHeight: number,
    viewportWidth: number,
    viewportHeight: number,
    gap: number,
    padding: number
) {
    const fallbackPlacement =
        preferredPlacement === "left"
            ? "right"
            : preferredPlacement === "right"
              ? "left"
              : preferredPlacement === "top"
                ? "bottom"
                : "top";

    if (
        fitsPlacement(
            preferredPlacement,
            anchorRect,
            overlayWidth,
            overlayHeight,
            viewportWidth,
            viewportHeight,
            gap,
            padding
        )
    ) {
        return preferredPlacement;
    }

    if (
        fitsPlacement(
            fallbackPlacement,
            anchorRect,
            overlayWidth,
            overlayHeight,
            viewportWidth,
            viewportHeight,
            gap,
            padding
        )
    ) {
        return fallbackPlacement;
    }

    return getMainAxisSpace(
        preferredPlacement,
        anchorRect,
        viewportWidth,
        viewportHeight,
        gap,
        padding
    ) >=
        getMainAxisSpace(
            fallbackPlacement,
            anchorRect,
            viewportWidth,
            viewportHeight,
            gap,
            padding
        )
        ? preferredPlacement
        : fallbackPlacement;
}

function computeFloatingPosition(
    anchorRect: FloatingAnchorRect,
    overlayWidth: number,
    overlayHeight: number,
    preferredPlacement: FloatingPlacement,
    gap: number,
    padding: number
): FloatingPosition {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const placement = resolvePlacement(
        preferredPlacement,
        anchorRect,
        overlayWidth,
        overlayHeight,
        viewportWidth,
        viewportHeight,
        gap,
        padding
    );

    const maxLeft = Math.max(padding, viewportWidth - overlayWidth - padding);
    const maxTop = Math.max(padding, viewportHeight - overlayHeight - padding);

    if (placement === "left" || placement === "right") {
        const top = clamp(
            anchorRect.top + anchorRect.height / 2 - overlayHeight / 2,
            padding,
            maxTop
        );
        const left = clamp(
            placement === "left"
                ? anchorRect.left - overlayWidth - gap
                : anchorRect.right + gap,
            padding,
            maxLeft
        );

        return { top, left };
    }

    const left = clamp(
        anchorRect.left + anchorRect.width / 2 - overlayWidth / 2,
        padding,
        maxLeft
    );
    const top = clamp(
        placement === "top"
            ? anchorRect.top - overlayHeight - gap
            : anchorRect.bottom + gap,
        padding,
        maxTop
    );

    return { top, left };
}

export function useFloatingPosition({
    isOpen,
    overlayRef,
    getAnchorRect,
    preferredPlacement,
    gap = 12,
    padding = 12,
}: UseFloatingPositionOptions) {
    const [position, setPosition] = useState<FloatingPosition | null>(null);

    const updatePosition = useCallback(() => {
        if (!isOpen) {
            setPosition(null);
            return;
        }

        const overlay = overlayRef.current;
        const anchorRect = getAnchorRect();
        if (!overlay || !anchorRect) return;

        const overlayRect = overlay.getBoundingClientRect();
        const nextPosition = computeFloatingPosition(
            anchorRect,
            overlayRect.width,
            overlayRect.height,
            preferredPlacement,
            gap,
            padding
        );

        setPosition((current) => {
            if (
                current &&
                current.top === nextPosition.top &&
                current.left === nextPosition.left
            ) {
                return current;
            }
            return nextPosition;
        });
    }, [gap, getAnchorRect, isOpen, overlayRef, padding, preferredPlacement]);

    useLayoutEffect(() => {
        if (!isOpen) {
            setPosition(null);
            return;
        }

        updatePosition();
        const rafId = window.requestAnimationFrame(updatePosition);
        const overlay = overlayRef.current;
        const resizeObserver =
            overlay && typeof ResizeObserver !== "undefined"
                ? new ResizeObserver(() => {
                      updatePosition();
                  })
                : null;

        if (overlay && resizeObserver) {
            resizeObserver.observe(overlay);
        }

        window.addEventListener("resize", updatePosition);
        window.addEventListener("scroll", updatePosition, true);

        return () => {
            window.cancelAnimationFrame(rafId);
            resizeObserver?.disconnect();
            window.removeEventListener("resize", updatePosition);
            window.removeEventListener("scroll", updatePosition, true);
        };
    }, [isOpen, overlayRef, updatePosition]);

    return position;
}
