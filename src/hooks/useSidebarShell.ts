"use client";

import { useCallback, useEffect, useState } from "react";

interface UseSidebarShellOptions {
    defaultOpen?: boolean;
    mobileBreakpoint?: number;
}

export function useSidebarShell(options: UseSidebarShellOptions = {}) {
    const { defaultOpen = true, mobileBreakpoint = 800 } = options;

    const [isSidebarOpen, setIsSidebarOpen] = useState(defaultOpen);
    const [isOverlay, setIsOverlay] = useState(false);
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const mq = window.matchMedia(`(max-width: ${mobileBreakpoint - 1}px)`);
        setIsMobile(mq.matches);
        const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
        mq.addEventListener("change", handler);
        return () => mq.removeEventListener("change", handler);
    }, [mobileBreakpoint]);

    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth >= mobileBreakpoint) {
                setIsOverlay(false);
                return;
            }

            // Auto-collapse only when a desktop sidebar becomes mobile.
            // Keep overlay sidebars open when the user explicitly opens them on mobile.
            if (isSidebarOpen && !isOverlay) {
                setIsSidebarOpen(false);
            }
        };

        handleResize();
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, [isOverlay, isSidebarOpen, mobileBreakpoint]);

    const close = useCallback(() => {
        setIsSidebarOpen(false);
        setIsOverlay(false);
    }, []);

    const toggle = useCallback(() => {
        if (isSidebarOpen) {
            setIsSidebarOpen(false);
            setIsOverlay(false);
            return;
        }
        const shouldOverlay = window.innerWidth < mobileBreakpoint;
        setIsOverlay(shouldOverlay);
        setIsSidebarOpen(true);
    }, [isSidebarOpen, mobileBreakpoint]);

    return {
        isSidebarOpen,
        isOverlay,
        isMobile,
        close,
        toggle,
    };
}
