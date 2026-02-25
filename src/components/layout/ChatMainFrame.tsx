"use client";

import { ReactNode, RefObject } from "react";

interface ChatMainFrameProps {
    header: ReactNode;
    thread: ReactNode;
    composer: ReactNode;
    disclaimer?: ReactNode;
    scrollRootRef?: RefObject<HTMLDivElement | null>;
}

export default function ChatMainFrame({
    header,
    thread,
    composer,
    disclaimer = null,
    scrollRootRef,
}: ChatMainFrameProps) {
    return (
        <div
            className="@container/main relative flex min-h-0 min-w-0 flex-1 flex-col -translate-y-[calc(env(safe-area-inset-bottom,0px)/2)] pt-[calc(env(safe-area-inset-bottom,0px)/2)]"
            data-chat-main-shell
            style={{ backgroundColor: "var(--workspace-bg)" }}
        >
            <div
                ref={scrollRootRef}
                data-scroll-root
                className="@w-sm/main:[scrollbar-gutter:stable_both-edges] touch:[scrollbar-width:none] custom-scrollbar relative flex min-h-0 min-w-0 flex-1 flex-col [scrollbar-gutter:stable] not-print:overflow-x-clip not-print:overflow-y-auto scroll-pt-(--header-height) [--sticky-padding-top:var(--header-height)] has-data-[fixed-header=less-than-xl]:@w-xl/main:scroll-pt-0 has-data-[fixed-header=less-than-xl]:@w-xl/main:[--sticky-padding-top:0px] has-data-[fixed-header=less-than-xxl]:@w-2xl/main:scroll-pt-0 has-data-[fixed-header=less-than-xxl]:@w-2xl/main:[--sticky-padding-top:0px]"
                style={{
                    ["--sticky-padding-bottom" as string]: "0px",
                    backgroundColor: "var(--workspace-bg)",
                }}
            >
                <header
                    id="page-header"
                    data-fixed-header="less-than-xl"
                    className="draggable no-draggable-children sticky top-0 z-20 w-full bg-workspace-bg pointer-events-none select-none [view-transition-name:var(--vt-page-header)] *:pointer-events-auto transition-none motion-safe:transition-none [box-shadow:var(--sharp-edge-top-shadow)]"
                    style={{ backgroundColor: "var(--workspace-bg)" }}
                >
                    {header}
                </header>

                <main
                    id="main"
                    className="min-h-0 flex-1"
                    style={{ backgroundColor: "var(--workspace-bg)" }}
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
            </div>
            <div
                id="thread-bottom-container"
                className="sticky bottom-0 group/thread-bottom-container relative isolate z-10 w-full shrink-0 basis-auto has-data-has-thread-error:pt-2 has-data-has-thread-error:[box-shadow:var(--sharp-edge-bottom-shadow)] md:border-transparent md:pt-0 dark:border-white/20 md:dark:border-transparent print:hidden content-fade single-line flex flex-col bg-workspace-bg [--content-fade-bg:var(--workspace-bg)]"
                style={{ backgroundColor: "var(--workspace-bg)", ["--content-fade-bg" as string]: "var(--workspace-bg)" }}
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
    );
}
