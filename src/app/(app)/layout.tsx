"use client";

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react";
import { Loader2 } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import {
    useAuth,
    isProfileStatusComplete,
    isProfileStatusIncomplete,
} from "@/lib/auth-context";
import Sidebar, { Character } from "@/components/Sidebar";
import AppFrame from "@/components/layout/AppFrame";
import { useSidebarShell } from "@/hooks/useSidebarShell";
import { mapCharacterToSidebar } from "@/lib/character-adapter";
import { isSetupBypassPath } from "@/lib/billing-plans";
import { UnauthorizedError } from "@/lib/token-store";
import {
    canContinueProfileSetup,
    clearProfileSetupState,
    markProfileSetupPending,
} from "@/lib/profile-setup-session";
import { UserSettingsProvider } from "@/lib/user-settings-context";
import { GrowthProvider } from "@/lib/growth-context";
import CheckInCalendarDialog from "@/components/growth/CheckInCalendarDialog";
import { Toaster } from "sonner";
import {
    useGetOrCreateChatMutation,
    useSidebarCharactersQuery,
} from "@/lib/query";

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
    const {
        user,
        logout,
        refreshUser,
        isInitialLoading: isAuthLoading,
        profileStatus,
        profileError,
    } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const isProfileReady = isProfileStatusComplete(profileStatus, user);
    const isProfileIncomplete = isProfileStatusIncomplete(profileStatus, user);
    const appUserId = isProfileReady ? user?.id : undefined;
    const shouldShowProfileError = Boolean(user && profileStatus === "error");

    const { isSidebarOpen, isOverlay, toggle: toggleSidebar, close: closeSidebar } = useSidebarShell();
    const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
    const [isProfileRetrying, setIsProfileRetrying] = useState(false);
    const {
        data: sidebarApiCharacters,
        refetch: refetchSidebarCharacters,
    } = useSidebarCharactersQuery(appUserId);
    const openChatMutation = useGetOrCreateChatMutation(appUserId);
    const sidebarCharacters = useMemo<Character[]>(
        () =>
            (sidebarApiCharacters ?? []).map((character) =>
                mapCharacterToSidebar(character),
            ),
        [sidebarApiCharacters],
    );

    const shouldBlockForRedirect =
        !user || (isProfileIncomplete && !isSetupBypassPath(pathname));

    // Redirect if not authenticated or profile incomplete
    useEffect(() => {
        if (isAuthLoading) {
            return;
        }

        if (!user) {
            clearProfileSetupState();
            router.replace("/login");
            return;
        }

        if (profileStatus === "error") {
            clearProfileSetupState();
            if (profileError instanceof UnauthorizedError) {
                void logout().finally(() => {
                    router.replace("/login");
                });
            }
            return;
        }

        if (profileStatus !== "loaded") {
            return;
        }

        if (isProfileReady || isSetupBypassPath(pathname)) {
            clearProfileSetupState();
            return;
        }

        if (isProfileIncomplete && canContinueProfileSetup(user.id)) {
            markProfileSetupPending(user.id);
            router.replace("/setup");
            return;
        }

        void logout().finally(() => {
            clearProfileSetupState();
            router.replace("/login");
        });
    }, [
        user,
        isAuthLoading,
        profileStatus,
        profileError,
        isProfileReady,
        isProfileIncomplete,
        pathname,
        router,
        logout,
    ]);

    const refreshSidebarCharacters = useCallback(async () => {
        if (!user) return;
        await refetchSidebarCharacters();
    }, [refetchSidebarCharacters, user]);

    const handleSelectCharacter = async (character: Character) => {
        try {
            const chatId = await openChatMutation.mutateAsync(character.id);
            router.push(`/chat/${chatId}`);
        } catch (err) {
            console.error("Failed to open chat:", err);
        }
    };

    const handleRetryProfile = useCallback(async () => {
        setIsProfileRetrying(true);
        try {
            await refreshUser();
        } catch (err) {
            console.error("Failed to refresh profile:", err);
        } finally {
            setIsProfileRetrying(false);
        }
    }, [refreshUser]);

    const sidebarContextValue = useMemo(
        () => ({
            isSidebarOpen,
            isOverlay,
            toggleSidebar,
            closeSidebar,
            sidebarCharacters,
            selectedCharacterId,
            setSelectedCharacterId,
            refreshSidebarCharacters,
        }),
        [
            isSidebarOpen,
            isOverlay,
            toggleSidebar,
            closeSidebar,
            sidebarCharacters,
            selectedCharacterId,
            refreshSidebarCharacters,
        ],
    );

    if (shouldShowProfileError) {
        return (
            <div className="flex h-screen items-center justify-center bg-white px-6">
                <div className="w-full max-w-sm rounded-lg border border-red-100 bg-red-50 p-6 text-center">
                    <h1 className="text-base font-semibold text-red-700">
                        账号资料加载失败
                    </h1>
                    <p className="mt-2 text-sm leading-6 text-red-600">
                        请重试加载资料。若问题持续，请重新登录。
                    </p>
                    <button
                        type="button"
                        onClick={handleRetryProfile}
                        disabled={isProfileRetrying}
                        className="mt-5 inline-flex h-10 items-center justify-center rounded-lg bg-red-600 px-4 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {isProfileRetrying ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                正在重试
                            </>
                        ) : (
                            "重试"
                        )}
                    </button>
                </div>
            </div>
        );
    }

    // Show loading state while checking auth
    if (isAuthLoading || shouldBlockForRedirect) {
        return (
            <div className="flex h-screen items-center justify-center bg-white">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
        );
    }

    return (
        <UserSettingsProvider>
            <GrowthProvider>
                <SidebarContext.Provider value={sidebarContextValue}>
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
                    >
                        {children}
                    </AppFrame>
                </SidebarContext.Provider>
                <CheckInCalendarDialog />
                <Toaster position="bottom-right" richColors closeButton duration={4000} />
            </GrowthProvider>
        </UserSettingsProvider>
    );
}
