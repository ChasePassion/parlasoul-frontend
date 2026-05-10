"use client";

import { ReactNode } from "react";

interface AppFrameProps {
    sidebar: ReactNode;
    children: ReactNode;
    isSidebarOpen: boolean;
    isOverlay: boolean;
    isMobile: boolean;
    onCloseSidebar: () => void;
}

export default function AppFrame({
    sidebar,
    children,
    isSidebarOpen,
    isOverlay,
    isMobile,
    onCloseSidebar,
}: AppFrameProps) {
    const shouldUseOverlay = isSidebarOpen && isOverlay;
    const shouldShowSidebar = isSidebarOpen || !isMobile;

    return (
        <div className="flex h-svh w-screen flex-col">
            <div className="relative flex min-h-0 w-full flex-1">
                <div className="relative flex min-h-0 w-full flex-1">
                    {shouldUseOverlay && (
                        <div
                            className="fixed inset-0 z-40 bg-black/50 transition-opacity"
                            onClick={onCloseSidebar}
                        />
                    )}
                    <aside
                        className={`
                            shrink-0 h-full overflow-hidden transition-all duration-300 ease-in-out
                            ${shouldUseOverlay ? "fixed left-0 top-0 z-50" : "relative"}
                            ${isSidebarOpen ? "w-64" : "w-14"}
                            ${!shouldShowSidebar ? "hidden" : ""}
                        `}
                    >
                        {sidebar}
                    </aside>

                    <section
                        className="relative flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-workspace-bg"
                        style={{ backgroundColor: "var(--workspace-bg)" }}
                    >
                        {children}
                    </section>
                </div>
            </div>
        </div>
    );
}
