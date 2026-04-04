"use client";

import { useState, useEffect, createContext, useContext, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth, isProfileComplete } from "@/lib/auth-context";
import { getSidebarCharacters } from "@/lib/api";
import Sidebar, { Character } from "@/components/Sidebar";
import AppFrame from "@/components/layout/AppFrame";
import { useSidebarShell } from "@/hooks/useSidebarShell";
import { mapCharacterToSidebar } from "@/lib/character-adapter";
import { getOrCreateChatId } from "@/lib/chat-helpers";
import { UserSettingsProvider } from "@/lib/user-settings-context";
import { GrowthProvider } from "@/lib/growth-context";
import CheckInCalendarDialog from "@/components/growth/CheckInCalendarDialog";

// Context for sidebar state
interface SidebarContextType {
    isSidebarOpen: boolean;
    isOverlay: boolean;
    toggleSidebar: () => void;
    closeSidebar: () => void;
    sidebarCharacters: Character[];
    selectedCharacterId: string | null;
    setSelectedCharacterId: (id: string | null) => void;
    refreshSidebarCharacters: () => Promise<void>;
}

const SidebarContext = createContext<SidebarContextType | null>(null);

export function useSidebar() {
    const context = useContext(SidebarContext);
    if (!context) {
        throw new Error("useSidebar must be used within AppLayout");
    }
    return context;
}

export default function AppLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const { user, isLoading: isAuthLoading } = useAuth();
    const router = useRouter();

    const { isSidebarOpen, isOverlay, toggle: toggleSidebar, close: closeSidebar } = useSidebarShell();
    const [sidebarCharacters, setSidebarCharacters] = useState<Character[]>([]);
    const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);

    // Redirect if not authenticated or profile incomplete
    useEffect(() => {
        if (!isAuthLoading) {
            if (!user) {
                router.push("/login");
            } else if (!isProfileComplete(user)) {
                router.push("/setup");
            }
        }
    }, [user, isAuthLoading, router]);

    // Load sidebar characters
    const refreshSidebarCharacters = useCallback(async () => {
        if (!user) return;
        try {
            const apiCharacters = await getSidebarCharacters();
            const mapped: Character[] = apiCharacters.map((character) =>
                mapCharacterToSidebar(character),
            );
            setSidebarCharacters(mapped);
        } catch (err) {
            console.error("Failed to load sidebar characters:", err);
        }
    }, [user]);

    useEffect(() => {
        refreshSidebarCharacters();
    }, [refreshSidebarCharacters]);

    const handleSelectCharacter = async (character: Character) => {
        try {
            const chatId = await getOrCreateChatId(character.id);
            router.push(`/chat/${chatId}`);
        } catch (err) {
            console.error("Failed to open chat:", err);
        }
    };

    // Show loading state while checking auth
    if (isAuthLoading || !user) {
        return (
            <div className="flex h-screen items-center justify-center bg-white">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <UserSettingsProvider>
            <GrowthProvider>
                <SidebarContext.Provider
                    value={{
                        isSidebarOpen,
                        isOverlay,
                        toggleSidebar,
                        closeSidebar,
                        sidebarCharacters,
                        selectedCharacterId,
                        setSelectedCharacterId,
                        refreshSidebarCharacters,
                    }}
                >
                    <AppFrame
                        sidebar={
                            <Sidebar
                                characters={sidebarCharacters}
                                selectedCharacterId={selectedCharacterId}
                                onSelectCharacter={handleSelectCharacter}
                                onToggle={toggleSidebar}
                                isCollapsed={!isSidebarOpen}
                            />
                        }
                        isSidebarOpen={isSidebarOpen}
                        isOverlay={isOverlay}
                        onCloseSidebar={closeSidebar}
                        onToggleSidebar={toggleSidebar}
                    >
                        {children}
                    </AppFrame>
                </SidebarContext.Provider>
                <CheckInCalendarDialog />
            </GrowthProvider>
        </UserSettingsProvider>
    );
}
