"use client";

import { ReactNode, RefObject, useCallback, useLayoutEffect, useRef, useState } from "react";

interface ChatMainFrameProps {
    header: ReactNode;
    thread: ReactNode;
    composer: ReactNode;
    scrollRootRef?: RefObject<HTMLDivElement | null>;
    onDropImages?: (files: File[]) => void;
}

const DEFAULT_HEADER_HEIGHT = 64;

export default function ChatMainFrame({
    header,
    thread,
    composer,
    scrollRootRef,
    onDropImages,
}: ChatMainFrameProps) {
    const headerRef = useRef<HTMLElement | null>(null);
    const footerRef = useRef<HTMLDivElement | null>(null);
    const [headerHeight, setHeaderHeight] = useState(DEFAULT_HEADER_HEIGHT);
    const [footerHeight, setFooterHeight] = useState(0);
    const [scrollbarWidth, setScrollbarWidth] = useState(0);

    // Drag-drop state
    const [isDragging, setIsDragging] = useState(false);
    const dragCounter = useRef(0);

    const handleDragEnter = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        dragCounter.current++;
        if (e.dataTransfer.types.includes("Files")) setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        dragCounter.current--;
        if (dragCounter.current === 0) setIsDragging(false);
    }, []);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        dragCounter.current = 0;
        setIsDragging(false);
        if (!onDropImages) return;
        const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/"));
        if (files.length > 0) onDropImages(files);
    }, [onDropImages]);

    const EXTRA_BOTTOM = 80;

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
            onDragEnter={onDropImages ? handleDragEnter : undefined}
            onDragLeave={onDropImages ? handleDragLeave : undefined}
            onDragOver={onDropImages ? handleDragOver : undefined}
            onDrop={onDropImages ? handleDrop : undefined}
        >
            {/* Drag overlay */}
            {isDragging && (
                <div className="absolute inset-0 z-50 bg-black/20 backdrop-blur-sm flex items-center justify-center pointer-events-none">
                    <div className="bg-white/90 dark:bg-neutral-800/90 rounded-2xl px-8 py-6 shadow-lg flex flex-col items-center gap-2">
                        <svg viewBox="0 0 1024 1024" width="40" height="40" fill="currentColor" className="text-gray-500">
                            <path d="M896 89.6H128C72.704 89.6 28.16 134.144 28.16 189.44v645.12c0 55.296 44.544 99.84 99.84 99.84h768c55.296 0 99.84-44.544 99.84-99.84V189.44c0-55.296-44.544-99.84-99.84-99.84z m-768 76.8h768c12.8 0 23.04 10.24 23.04 23.04v459.776l-211.968-211.968c-11.264-11.264-26.112-17.408-41.472-17.408s-30.72 6.144-41.472 17.408L363.52 697.856l-96.768-96.768c-23.04-23.04-60.416-23.04-83.456 0l-78.848 78.848V189.44c0.512-12.8 10.752-23.04 23.552-23.04z m768 691.2H128c-12.8 0-23.04-10.24-23.04-23.04v-45.568L225.28 668.672l111.104 111.104c7.168 7.168 16.896 11.264 27.136 11.264s19.968-4.096 27.136-11.264L665.6 504.832l253.44 253.44V834.56c0 12.8-10.24 23.04-23.04 23.04z" />
                            <path d="M289.28 386.56m-64 0a64 64 0 1 0 128 0 64 64 0 1 0-128 0Z" />
                        </svg>
                        <span className="text-gray-700 dark:text-gray-300 text-sm font-medium">释放以添加图片</span>
                    </div>
                </div>
            )}
            {/* Full-height scroll root — native scrollbar spans entire page */}
            <div
                ref={scrollRootRef}
                data-scroll-root
                className="@w-sm/main:[scrollbar-gutter:stable_both-edges] touch:[scrollbar-width:none] [@media(max-width:799px)]:[scrollbar-width:none] custom-scrollbar absolute inset-0 overflow-x-clip overflow-y-auto [overflow-anchor:none] [scrollbar-gutter:stable]"
                style={{
                    ["--header-height" as string]: `${headerHeight}px`,
                    scrollPaddingTop: `${headerHeight}px`,
                    scrollPaddingBottom: `${footerHeight + EXTRA_BOTTOM}px`,
                }}
            >
                <main
                    id="main"
                    className="shrink-0"
                    style={{
                        backgroundColor: "var(--workspace-bg)",
                        paddingTop: `${headerHeight}px`,
                        paddingBottom: `${footerHeight + EXTRA_BOTTOM}px`,
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
                className="draggable no-draggable-children absolute inset-x-0 top-0 z-20 bg-workspace-bg pointer-events-none select-none [view-transition-name:var(--vt-page-header)] *:pointer-events-auto transition-none motion-safe:transition-none [box-shadow:var(--sharp-edge-top-shadow)]"
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
                className="absolute bottom-0 inset-x-0 isolate z-10 has-data-has-thread-error:pt-2 has-data-has-thread-error:[box-shadow:var(--sharp-edge-bottom-shadow)] md:border-transparent md:pt-0 dark:border-white/20 md:dark:border-transparent print:hidden flex flex-col bg-workspace-bg"
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
