"use client";

import {
    createContext,
    useContext,
    ReactNode,
} from "react";
import { User } from "./api-service";
import { authClient } from "./auth-client";
import { mapBetterAuthSessionToUser } from "./auth-user-mapper";
import { clearBetterAuthJwt } from "./better-auth-token";

interface AuthContextType {
    user: User | null;
    isAuthed: boolean;
    isLoading: boolean;
    login: (email: string, code: string) => Promise<void>;
    logout: () => Promise<void>;
    refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const {
        data: session,
        isPending,
        refetch,
    } = authClient.useSession();

    const user = mapBetterAuthSessionToUser(session);
    const isAuthed = !!user;

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
        await refetch();
    };

    const refreshUser = async () => {
        clearBetterAuthJwt();
        const result = await authClient.getSession();
        if (result.error) {
            throw new Error(result.error.message || "刷新用户信息失败");
        }

        await refetch();
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                isAuthed,
                isLoading: isPending,
                login,
                logout,
                refreshUser,
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
