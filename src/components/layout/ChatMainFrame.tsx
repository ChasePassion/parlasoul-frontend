"use client";

import { ReactNode, RefObject, useLayoutEffect, useRef, useState } from "react";

interface ChatMainFrameProps {
    header: ReactNode;
    thread: ReactNode;
    composer: ReactNode;
    scrollRootRef?: RefObject<HTMLDivElement | null>;
}

const DEFAULT_HEADER_HEIGHT = 64;

export default function ChatMainFrame({
    header,
    thread,
    composer,
    scrollRootRef,
}: ChatMainFrameProps) {
    const headerRef = useRef<HTMLElement | null>(null);
    const footerRef = useRef<HTMLDivElement | null>(null);
    const [headerHeight, setHeaderHeight] = useState(DEFAULT_HEADER_HEIGHT);
    const [footerHeight, setFooterHeight] = useState(0);
    const [scrollbarWidth, setScrollbarWidth] = useState(0);

    useLayoutEffect(() => {
        const update = () => {
            const nextHeaderHeight = Math.ceil(
                headerRef.current?.getBoundingClientRect().height ?? DEFAULT_HEADER_HEIGHT
            );
            const nextFooterHeight = Math.ceil(
                footerRef.current?.getBoundingClientRect().height ?? 0
            );

            setHeaderHeight((prev) =>
                prev === nextHeaderHeight ? prev : nextHeaderHeight
            );
            setFooterHeight((prev) =>
                prev === nextFooterHeight ? prev : nextFooterHeight
            );
        };

        update();

        if (typeof window === "undefined") {
            return;
        }

        window.addEventListener("resize", update);

        if (typeof ResizeObserver === "undefined") {
            return () => {
                window.removeEventListener("resize", update);
            };
        }

        const observer = new ResizeObserver(() => {
            update();
        });

        if (headerRef.current) {
            observer.observe(headerRef.current);
        }

        if (footerRef.current) {
            observer.observe(footerRef.current);
        }

        return () => {
            observer.disconnect();
            window.removeEventListener("resize", update);
        };
    }, []);

    // Measure scrollbar width once after mount (before paint).
    // Temporarily force overflow-y:scroll to get an accurate measurement
    // regardless of whether content currently overflows.
    useLayoutEffect(() => {
        const root = scrollRootRef?.current;
        if (!root) return;

        const prev = root.style.overflowY;
        root.style.overflowY = "scroll";
        const width = root.offsetWidth - root.clientWidth;
        root.style.overflowY = prev;

        if (width > 0) {
            setScrollbarWidth(width);
        }
    }, [scrollRootRef]);

    return (
        <div
            className="@container/main relative min-h-0 min-w-0 flex-1 overflow-hidden"
            data-chat-main-shell
            style={{ backgroundColor: "var(--workspace-bg)" }}
        >
            {/* Full-height scroll root — native scrollbar spans entire page */}
            <div
                ref={scrollRootRef}
                data-scroll-root
                className="@w-sm/main:[scrollbar-gutter:stable_both-edges] touch:[scrollbar-width:none] custom-scrollbar absolute inset-0 overflow-x-clip overflow-y-auto [overflow-anchor:none] [scrollbar-gutter:stable]"
                style={{
                    ["--header-height" as string]: `${headerHeight}px`,
                    scrollPaddingTop: `${headerHeight}px`,
                    scrollPaddingBottom: `${footerHeight}px`,
                }}
            >
                <main
                    id="main"
                    className="shrink-0"
                    style={{
                        backgroundColor: "var(--workspace-bg)",
                        paddingTop: `${headerHeight}px`,
                        paddingBottom: `${footerHeight}px`,
                    }}
                >
                    <div id="thread" className="group/thread flex min-h-full flex-col">
                        <div role="presentation" className="composer-parent flex flex-1 flex-col focus-visible:outline-0">
                            <div className="relative basis-auto flex-col grow flex">
                                <div
                                    aria-hidden="true"
                                    data-edge="true"
                                    className="pointer-events-none absolute top-0 h-px w-px"
                                />

                                <div className="flex flex-1 flex-col text-sm">
                                    {thread}
                                </div>

                                <div
                                    aria-hidden="true"
                                    data-edge="true"
                                    className="pointer-events-none absolute bottom-0 h-px w-px"
                                />
                            </div>
                        </div>
                    </div>
                </main>
            </div>

            {/* Header overlay — offset right by scrollbar width so it doesn't cover the scrollbar */}
            <header
                ref={headerRef}
                id="page-header"
                data-fixed-header="less-than-xl"
                className="draggable no-draggable-children absolute left-0 top-0 z-20 w-full bg-workspace-bg pointer-events-none select-none [view-transition-name:var(--vt-page-header)] *:pointer-events-auto transition-none motion-safe:transition-none [box-shadow:var(--sharp-edge-top-shadow)]"
                style={{
                    backgroundColor: "var(--workspace-bg)",
                    right: `${scrollbarWidth}px`,
                }}
            >
                {header}
            </header>

            {/* Footer overlay — contentEditable NOT inside scroll container, offset by scrollbar width */}
            <div
                ref={footerRef}
                id="thread-bottom-container"
                className="absolute bottom-0 left-0 isolate z-10 w-full has-data-has-thread-error:pt-2 has-data-has-thread-error:[box-shadow:var(--sharp-edge-bottom-shadow)] md:border-transparent md:pt-0 dark:border-white/20 md:dark:border-transparent print:hidden flex flex-col bg-workspace-bg"
                style={{
                    backgroundColor: "var(--workspace-bg)",
                    paddingBottom: "env(safe-area-inset-bottom,0px)",
                    right: `${scrollbarWidth}px`,
                }}
            >
                <div
                    className="content-fade single-line flex flex-col [--content-fade-bg:var(--workspace-bg)]"
                    style={{
                        backgroundColor: "var(--workspace-bg)",
                        ["--content-fade-bg" as string]: "var(--workspace-bg)",
                    }}
                >
                    <div className="relative h-0" />
                    <div id="thread-bottom" style={{ backgroundColor: "var(--workspace-bg)" }}>
                        {composer}
                    </div>
                    <div aria-hidden="true" className="-mt-4 h-6 w-full bg-workspace-bg" />
                </div>
            </div>
        </div>
    );
}
