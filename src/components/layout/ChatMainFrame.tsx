"use client";

import { ReactNode, RefObject, useLayoutEffect, useRef, useState } from "react";

interface ChatMainFrameProps {
    header: ReactNode;
    thread: ReactNode;
    composer: ReactNode;
    disclaimer?: ReactNode;
    scrollRootRef?: RefObject<HTMLDivElement | null>;
}

const DEFAULT_HEADER_HEIGHT = 64;

export default function ChatMainFrame({
    header,
    thread,
    composer,
    disclaimer = null,
    scrollRootRef,
}: ChatMainFrameProps) {
    const headerRef = useRef<HTMLElement | null>(null);
    const footerRef = useRef<HTMLDivElement | null>(null);
    const [headerHeight, setHeaderHeight] = useState(DEFAULT_HEADER_HEIGHT);
    const [footerHeight, setFooterHeight] = useState(0);

    useLayoutEffect(() => {
        const updateStickyOffsets = () => {
            const nextHeaderHeight = Math.ceil(
                headerRef.current?.getBoundingClientRect().height ?? DEFAULT_HEADER_HEIGHT
            );
            const nextFooterHeight = Math.ceil(
                footerRef.current?.getBoundingClientRect().height ?? 0
            );

            setHeaderHeight((previous) =>
                previous === nextHeaderHeight ? previous : nextHeaderHeight
            );
            setFooterHeight((previous) =>
                previous === nextFooterHeight ? previous : nextFooterHeight
            );
        };

        updateStickyOffsets();

        if (typeof window === "undefined") {
            return;
        }

        window.addEventListener("resize", updateStickyOffsets);

        if (typeof ResizeObserver === "undefined") {
            return () => {
                window.removeEventListener("resize", updateStickyOffsets);
            };
        }

        const observer = new ResizeObserver(() => {
            updateStickyOffsets();
        });

        if (headerRef.current) {
            observer.observe(headerRef.current);
        }

        if (footerRef.current) {
            observer.observe(footerRef.current);
        }

        return () => {
            observer.disconnect();
            window.removeEventListener("resize", updateStickyOffsets);
        };
    }, []);

    return (
        <div
            ref={scrollRootRef}
            data-scroll-root
            className="@container/main @w-sm/main:[scrollbar-gutter:stable_both-edges] touch:[scrollbar-width:none] custom-scrollbar relative flex min-h-0 min-w-0 flex-1 flex-col [scrollbar-gutter:stable] not-print:overflow-x-clip not-print:overflow-y-auto [overflow-anchor:none]"
            data-chat-main-shell
            style={{
                backgroundColor: "var(--workspace-bg)",
                ["--header-height" as string]: `${headerHeight}px`,
                ["--sticky-padding-bottom" as string]: `${footerHeight}px`,
                scrollPaddingTop: `${headerHeight}px`,
                scrollPaddingBottom: `${footerHeight}px`,
            }}
        >
            <header
                ref={headerRef}
                id="page-header"
                data-fixed-header="less-than-xl"
                className="draggable no-draggable-children sticky top-0 z-20 w-full bg-workspace-bg pointer-events-none select-none [view-transition-name:var(--vt-page-header)] *:pointer-events-auto transition-none motion-safe:transition-none [box-shadow:var(--sharp-edge-top-shadow)]"
                style={{ backgroundColor: "var(--workspace-bg)" }}
            >
                {header}
            </header>

            <main
                id="main"
                className="shrink-0"
                style={{
                    backgroundColor: "var(--workspace-bg)",
                    minHeight: `calc(100% - ${headerHeight}px - ${footerHeight}px)`,
                }}
            >
                <div id="thread" className="group/thread flex min-h-full flex-col">
                    <div role="presentation" className="composer-parent flex flex-1 flex-col focus-visible:outline-0">
                        <div className="relative basis-auto flex-col -mb-(--composer-overlap-px) [--composer-overlap-px:28px] grow flex">
                            <div
                                aria-hidden="true"
                                data-edge="true"
                                className="pointer-events-none absolute top-0 h-px w-px"
                            />

                            <div className="flex flex-col text-sm">
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
            <div
                ref={footerRef}
                id="thread-bottom-container"
                className="sticky bottom-0 group/thread-bottom-container isolate z-10 w-full has-data-has-thread-error:pt-2 has-data-has-thread-error:[box-shadow:var(--sharp-edge-bottom-shadow)] md:border-transparent md:pt-0 dark:border-white/20 md:dark:border-transparent print:hidden flex flex-col bg-workspace-bg"
                style={{
                    backgroundColor: "var(--workspace-bg)",
                    paddingBottom: "env(safe-area-inset-bottom,0px)",
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
                    <div
                        className="-mt-4 text-token-text-secondary relative w-full overflow-hidden text-center text-xs [view-transition-name:var(--vt-disclaimer)] md:px-[60px]"
                        style={{ height: "auto", opacity: 1, transform: "none", backgroundColor: "var(--workspace-bg)" }}
                    >
                        <div
                            className="select-none active:select-auto data-has-range-start:select-auto flex min-h-8 w-full items-center justify-center p-2"
                            data-has-range-start=""
                        >
                            <div className="pointer-events-auto">{disclaimer}</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
