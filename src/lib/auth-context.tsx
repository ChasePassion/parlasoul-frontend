"use client";

import {
    createContext,
    useContext,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from "react";
import { getMyEntitlements } from "./api";
import type { User, UserEntitlementsResponse } from "./api-service";
import { authClient } from "./auth-client";
import { mapBetterAuthSessionToUser } from "./auth-user-mapper";
import { clearBetterAuthJwt } from "./better-auth-token";

interface AuthContextType {
    user: User | null;
    entitlements: UserEntitlementsResponse | null;
    isAuthed: boolean;
    isLoading: boolean;
    isEntitlementsLoading: boolean;
    login: (email: string, code: string) => Promise<void>;
    logout: () => Promise<void>;
    refreshUser: () => Promise<void>;
    refreshEntitlements: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const {
        data: session,
        isPending,
        refetch,
    } = authClient.useSession();

    const [entitlements, setEntitlements] = useState<UserEntitlementsResponse | null>(null);
    const [isEntitlementsLoading, setIsEntitlementsLoading] = useState(false);
    const entitlementsRequestIdRef = useRef(0);

    const user = useMemo(() => mapBetterAuthSessionToUser(session), [session]);
    const userId = user?.id ?? null;
    const isAuthed = !!user;

    const refreshEntitlements = useCallback(async () => {
        const requestId = entitlementsRequestIdRef.current + 1;
        entitlementsRequestIdRef.current = requestId;

        if (!userId) {
            setEntitlements(null);
            setIsEntitlementsLoading(false);
            return;
        }

        setIsEntitlementsLoading(true);

        try {
            const nextEntitlements = await getMyEntitlements();

            if (entitlementsRequestIdRef.current === requestId) {
                setEntitlements(nextEntitlements);
            }
        } finally {
            if (entitlementsRequestIdRef.current === requestId) {
                setIsEntitlementsLoading(false);
            }
        }
    }, [userId]);

    useEffect(() => {
        if (!userId) {
            entitlementsRequestIdRef.current += 1;
            setEntitlements(null);
            setIsEntitlementsLoading(false);
            return;
        }

        setEntitlements(null);

        void refreshEntitlements().catch((error) => {
            console.error("Failed to refresh entitlements:", error);
        });
    }, [refreshEntitlements, userId]);

    const login = async (email: string, code: string) => {
        const result = await authClient.signIn.emailOtp({
            email,
            otp: code,
        });

        if (result.error) {
            throw new Error(result.error.message || "验证码登录失败");
        }

        clearBetterAuthJwt();
        await refetch();
    };

    const logout = async () => {
        const result = await authClient.signOut();
        if (result.error) {
            throw new Error(result.error.message || "退出登录失败");
        }

        clearBetterAuthJwt();
        entitlementsRequestIdRef.current += 1;
        setEntitlements(null);
        setIsEntitlementsLoading(false);
        await refetch();
    };

    const refreshUser = async () => {
        clearBetterAuthJwt();
        const result = await authClient.getSession();
        if (result.error) {
            throw new Error(result.error.message || "刷新用户信息失败");
        }

        await refetch();
        await refreshEntitlements();
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                entitlements,
                isAuthed,
                isLoading: isPending,
                isEntitlementsLoading,
                login,
                logout,
                refreshUser,
                refreshEntitlements,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}

export function isProfileComplete(user: User | null): boolean {
    return !!(user?.username && user?.avatar_url);
}
