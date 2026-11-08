"use client";

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { Loader2 } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import {
    useAuth,
    isProfileStatusComplete,
} from "@/lib/auth-context";
import Sidebar, { Character } from "@/components/Sidebar";
import AppFrame from "@/components/layout/AppFrame";
import { useSidebarShell } from "@/hooks/useSidebarShell";
import { mapCharacterToSidebar } from "@/lib/character-adapter";
import { markBrowserTourCompleted } from "@/lib/onboarding/tour-storage";
import {
    peekResumeCharacterId,
    takeResumeCharacterId,
} from "@/lib/pending-chat";
import { useOpenCharacterChat } from "@/hooks/useOpenCharacterChat";
import { UserSettingsProvider } from "@/lib/user-settings-context";
import { GrowthProvider } from "@/lib/growth-context";
import CheckInCalendarDialog from "@/components/growth/CheckInCalendarDialog";
import OnboardingTour from "@/components/onboarding/OnboardingTour";
import { useSidebarCharactersQuery } from "@/lib/query";

// Context for sidebar state
interface SidebarContextType {
    isSidebarOpen: boolean;
    isOverlay: boolean;
    isMobile: boolean;
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
        refreshUser,
        isInitialLoading: isAuthLoading,
        profileStatus,
    } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const isProfileReady = isProfileStatusComplete(profileStatus, user);
    const appUserId = isProfileReady ? user?.id : undefined;
    const shouldShowProfileError = Boolean(user && profileStatus === "error");
    // 认证已解析但无登录用户 = 访客。访客可以直接停留在发现页。
    const isGuest = !isAuthLoading && !user;
    const isDiscoverPage = pathname === "/";

    const { isSidebarOpen, isOverlay, isMobile, toggle: toggleSidebar, close: closeSidebar } = useSidebarShell();
    const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
    const [isProfileRetrying, setIsProfileRetrying] = useState(false);
    const {
        data: sidebarApiCharacters,
        refetch: refetchSidebarCharacters,
    } = useSidebarCharactersQuery(appUserId);
    const { open: openCharacterChat, prefetchOnIntent } = useOpenCharacterChat();
    const sidebarCharacters = useMemo<Character[]>(
        () =>
            (sidebarApiCharacters ?? []).map((character) =>
                mapCharacterToSidebar(character),
            ),
        [sidebarApiCharacters],
    );

    // 访客可以停留在发现页（含新人导览）。其它受保护页面由 middleware 拦截，
    // 客户端这里只做兜底跳转。
    const shouldBlockForRedirect = isGuest && !isDiscoverPage;

    useEffect(() => {
        if (isAuthLoading) {
            return;
        }

        // 访客：发现页直接浏览；若通过客户端导航落到受保护页，引导去登录。
        if (isGuest) {
            if (!isDiscoverPage) {
                router.replace(`/login?next=${encodeURIComponent(pathname)}`);
            }
            return;
        }
    }, [user, isAuthLoading, isGuest, isDiscoverPage, pathname, router]);

    // 兜底续接：登录页已经直接进聊天页；这里覆盖登录页开聊天失败的场合。
    // 等 profile 就绪再做，导航真的发起才消费 id。
    const resumeHandledRef = useRef(false);
    useEffect(() => {
        if (isAuthLoading || !isProfileReady || !user || resumeHandledRef.current) {
            return;
        }

        const characterId = peekResumeCharacterId();
        if (!characterId) {
            return;
        }
        markBrowserTourCompleted();

        const started = openCharacterChat(characterId);
        if (started) {
            resumeHandledRef.current = true;
            takeResumeCharacterId();
        }
        // 被连点去抖拦下时不标记、不消费，下一次挂载会再试。
    }, [isAuthLoading, isProfileReady, user, openCharacterChat]);

    const refreshSidebarCharacters = useCallback(async () => {
        if (!user) return;
        await refetchSidebarCharacters();
    }, [refetchSidebarCharacters, user]);

    const handleSelectCharacter = (character: Character) => {
        if (openCharacterChat(character)) {
            void refetchSidebarCharacters();
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
            isMobile,
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
            isMobile,
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
                                onPrefetchCharacter={prefetchOnIntent}
                            />
                        }
                        isSidebarOpen={isSidebarOpen}
                        isOverlay={isOverlay}
                        isMobile={isMobile}
                        onCloseSidebar={closeSidebar}
                    >
                        {children}
                    </AppFrame>
                </SidebarContext.Provider>
                <CheckInCalendarDialog />
                <OnboardingTour />
            </GrowthProvider>
        </UserSettingsProvider>
    );
}
