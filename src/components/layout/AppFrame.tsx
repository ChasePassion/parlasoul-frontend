"use client";

import { ReactNode } from "react";
import { SidebarToggleIcon } from "@/components/Sidebar";

interface AppFrameProps {
    sidebar: ReactNode;
    children: ReactNode;
    isSidebarOpen: boolean;
    isOverlay: boolean;
    onCloseSidebar: () => void;
    onToggleSidebar: () => void;
}

export default function AppFrame({
    sidebar,
    children,
    isSidebarOpen,
    isOverlay,
    onCloseSidebar,
    onToggleSidebar,
}: AppFrameProps) {
    return (
        <div className="flex h-svh w-screen flex-col">
            {isSidebarOpen && isOverlay && (
                <div
                    className="fixed inset-0 z-40 bg-black/50 transition-opacity"
                    onClick={onCloseSidebar}
                />
            )}
            <div className="relative z-0 flex min-h-0 w-full flex-1">
                <div className="relative flex min-h-0 w-full flex-1">
                    <aside
                        className={`
                            shrink-0 h-full overflow-hidden transition-all duration-300 ease-in-out
                            ${isOverlay ? "fixed left-0 top-0 z-50" : "relative"}
                            ${isSidebarOpen ? "w-64" : "w-0 min-[800px]:w-14"}
                        `}
                    >
                        {sidebar}
                    </aside>

                    <section
                        className="relative flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-workspace-bg"
                        style={{ backgroundColor: "var(--workspace-bg)" }}
                    >
                        {!isSidebarOpen && (
                            <button
                                onClick={onToggleSidebar}
                                className="absolute left-4 top-4 z-30 rounded-lg p-2 text-gray-500 hover:bg-gray-100 min-[800px]:hidden"
                                aria-label="Open Sidebar"
                            >
                                <SidebarToggleIcon className="h-5 w-5" />
                            </button>
                        )}
                        {children}
                    </section>
                </div>
            </div>
        </div>
    );
}
