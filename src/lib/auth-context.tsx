"use client";

import {
    createContext,
    useContext,
    useCallback,
    useMemo,
    useRef,
    type ReactNode,
} from "react";
import { apiService, type User, type UserEntitlementsResponse } from "./api-service";
import { authClient } from "./auth-client";
import {
    mapBetterAuthSessionToUser,
    mergeSessionUserWithProfile,
} from "./auth-user-mapper";
import type { BackendProfileStatus } from "./auth-profile-state";
import { clearBetterAuthJwt } from "./better-auth-token";
import { logger, Module, AuthEvent } from "./logger";
import { queryKeys, useUserEntitlementsQuery, useUserProfileQuery } from "./query";
import { useQueryClient } from "@tanstack/react-query";

interface AuthContextType {
    user: User | null;
    entitlements: UserEntitlementsResponse | null;
    profileStatus: BackendProfileStatus;
    profileError: unknown | null;
    isAuthed: boolean;
    isLoading: boolean;
    isInitialLoading: boolean;
    isEntitlementsLoading: boolean;
    login: (email: string, code: string) => Promise<void>;
    logout: () => Promise<void>;
    refreshUser: () => Promise<void>;
    refreshEntitlements: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const queryClient = useQueryClient();
    const {
        data: session,
        isPending,
        refetch,
    } = authClient.useSession();

    const sessionUser = useMemo(() => mapBetterAuthSessionToUser(session), [session]);
    const sessionUserId = sessionUser?.id ?? null;
    const {
        data: profileUser,
        isLoading: isProfileLoading,
        isFetching: isProfileFetching,
        isError: isProfileError,
        error: profileQueryError,
    } = useUserProfileQuery(sessionUserId);
    const profileStatus = useMemo<BackendProfileStatus>(() => {
        if (!sessionUserId) {
            return "anonymous";
        }

        if (profileUser) {
            return "loaded";
        }

        if (isProfileLoading || isProfileFetching) {
            return "loading";
        }

        if (isProfileError) {
            return "error";
        }

        return "loaded";
    }, [
        sessionUserId,
        profileUser,
        isProfileLoading,
        isProfileFetching,
        isProfileError,
    ]);
    const profileError = isProfileError ? profileQueryError : null;
    const user = useMemo(
        () => mergeSessionUserWithProfile(sessionUser, profileUser),
        [profileUser, sessionUser],
    );

    const hasAuthResolvedRef = useRef(false);
    if (!isPending && profileUser) {
        hasAuthResolvedRef.current = true;
    }
    const isInitialLoading =
        (isPending || profileStatus === "loading") && !hasAuthResolvedRef.current;

    const userId = user?.id ?? sessionUserId;
    const isAuthed = !!user;
    const {
        data: entitlementsData,
        isLoading: isEntitlementsQueryLoading,
        isFetching: isEntitlementsFetching,
        refetch: refetchEntitlements,
    } = useUserEntitlementsQuery(userId);
    const entitlements = entitlementsData ?? null;
    const isEntitlementsLoading =
        Boolean(userId) && (isEntitlementsQueryLoading || isEntitlementsFetching);

    const refreshEntitlements = useCallback(async () => {
        if (!userId) {
            return;
        }

        await refetchEntitlements();
    }, [refetchEntitlements, userId]);

    const login = useCallback(
        async (email: string, code: string) => {
            const startTime = Date.now();
            logger.info(Module.AUTH, AuthEvent.LOGIN_STARTED, "Login started", {
                email_hint: email.split("@").pop(),
            });

            const result = await authClient.signIn.emailOtp({
                email,
                otp: code,
            });

            logger.info(Module.AUTH, AuthEvent.LOGIN_API_CALLED, "signIn.emailOtp completed", {
                has_error: !!result.error,
                error_code: result.error?.code,
                has_session: !!result.data,
                elapsed_ms: Date.now() - startTime,
            });

            if (result.error) {
                logger.fromError(Module.AUTH, result.error, AuthEvent.LOGIN_FAILED, {
                    error_code: result.error.code,
                });
                throw new Error(result.error.message || "验证码登录失败");
            }

            clearBetterAuthJwt();
            logger.info(Module.AUTH, AuthEvent.SESSION_REFETCHED, "JWT cleared, resetting query client");

            await queryClient.cancelQueries();
            queryClient.clear();
            await refetch();

            logger.info(Module.AUTH, AuthEvent.LOGIN_COMPLETED, "Login completed", {
                elapsed_ms: Date.now() - startTime,
            });
        },
        [queryClient, refetch],
    );

    const logout = useCallback(
        async () => {
            logger.info(Module.AUTH, AuthEvent.LOGOUT_STARTED, "Logout started");

            const result = await authClient.signOut();
            if (result.error) {
                throw new Error(result.error.message || "退出登录失败");
            }

            clearBetterAuthJwt();
            await queryClient.cancelQueries();
            queryClient.clear();

            logger.info(Module.AUTH, AuthEvent.LOGOUT_COMPLETED, "Logout completed");
        },
        [queryClient],
    );

    const refreshUser = useCallback(
        async () => {
            clearBetterAuthJwt();
            const result = await authClient.getSession();
            if (result.error) {
                throw new Error(result.error.message || "刷新用户信息失败");
            }

            const refreshedSessionUser = mapBetterAuthSessionToUser(result.data);
            await refetch();
            if (refreshedSessionUser) {
                await queryClient.fetchQuery({
                    queryKey: queryKeys.user.profile(refreshedSessionUser.id),
                    queryFn: ({ signal }) => apiService.getMyProfile({ signal }),
                });
            }
            await refreshEntitlements();
        },
        [queryClient, refetch, refreshEntitlements],
    );

    const authContextValue = useMemo(
        () => ({
            user,
            entitlements,
            profileStatus,
            profileError,
            isAuthed,
            isLoading: isPending || profileStatus === "loading",
            isInitialLoading,
            isEntitlementsLoading,
            login,
            logout,
            refreshUser,
            refreshEntitlements,
        }),
        [
            user,
            entitlements,
            profileStatus,
            profileError,
            isAuthed,
            isPending,
            isInitialLoading,
            isEntitlementsLoading,
            login,
            logout,
            refreshUser,
            refreshEntitlements,
        ],
    );

    return (
        <AuthContext.Provider value={authContextValue}>
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

export {
    isProfileComplete,
    isProfileStatusComplete,
    isProfileStatusIncomplete,
    type BackendProfileStatus,
} from "./auth-profile-state";
