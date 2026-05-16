"use client";

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from "react";
import type { DisplayMode } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import {
    useUpdateUserSettingsMutation,
    useUserSettingsQuery,
} from "@/lib/query";

const USER_SETTINGS_STORAGE_KEY = "user_settings_v2";
const DEFAULT_MESSAGE_FONT_SIZE = 16;
const MIN_MESSAGE_FONT_SIZE = 14;
const MAX_MESSAGE_FONT_SIZE = 24;
const DEFAULT_DISPLAY_MODE: DisplayMode = "concise";
const DEFAULT_MEMORY_ENABLED = true;
const DEFAULT_REPLY_CARD_ENABLED = true;
const DEFAULT_MIXED_INPUT_AUTO_TRANSLATE_ENABLED = true;
const DEFAULT_AUTO_READ_ALOUD_ENABLED = true;
const DEFAULT_PREFERRED_EXPRESSION_BIAS_ENABLED = true;
const DEFAULT_PROACTIVE_ENABLED = false;
const DEFAULT_TIMEZONE = "Asia/Shanghai";
const SETTINGS_SYNC_DEBOUNCE_MS = 400;

interface SettingsState {
    messageFontSize: number;
    displayMode: DisplayMode;
    memoryEnabled: boolean;
    replyCardEnabled: boolean;
    mixedInputAutoTranslateEnabled: boolean;
    autoReadAloudEnabled: boolean;
    preferredExpressionBiasEnabled: boolean;
    proactiveEnabled: boolean;
    timezone: string;
}

interface UserSettingsContextType extends SettingsState {
    setMessageFontSize: (size: number) => void;
    setDisplayMode: (mode: DisplayMode) => void;
    setMemoryEnabled: (enabled: boolean) => void;
    setReplyCardEnabled: (enabled: boolean) => void;
    setMixedInputAutoTranslateEnabled: (enabled: boolean) => void;
    setAutoReadAloudEnabled: (enabled: boolean) => void;
    setPreferredExpressionBiasEnabled: (enabled: boolean) => void;
    setProactiveEnabled: (enabled: boolean) => void;
    minMessageFontSize: number;
    maxMessageFontSize: number;
    isLoading: boolean;
    isSaving: boolean;
    error: string | null;
    retrySync: () => Promise<void>;
}

interface RemoteUserSettingsResponse {
    message_font_size: number;
    display_mode?: DisplayMode;
    memory_enabled?: boolean;
    reply_card_enabled?: boolean;
    mixed_input_auto_translate_enabled?: boolean;
    auto_read_aloud_enabled?: boolean;
    preferred_expression_bias_enabled?: boolean;
    proactive_enabled?: boolean;
    timezone?: string;
}

const UserSettingsContext = createContext<UserSettingsContextType | undefined>(
    undefined
);

const clampMessageFontSize = (size: number): number => {
    if (Number.isNaN(size)) return DEFAULT_MESSAGE_FONT_SIZE;
    return Math.min(MAX_MESSAGE_FONT_SIZE, Math.max(MIN_MESSAGE_FONT_SIZE, Math.round(size)));
};

const defaultState: SettingsState = {
    messageFontSize: DEFAULT_MESSAGE_FONT_SIZE,
    displayMode: DEFAULT_DISPLAY_MODE,
    memoryEnabled: DEFAULT_MEMORY_ENABLED,
    replyCardEnabled: DEFAULT_REPLY_CARD_ENABLED,
    mixedInputAutoTranslateEnabled: DEFAULT_MIXED_INPUT_AUTO_TRANSLATE_ENABLED,
    autoReadAloudEnabled: DEFAULT_AUTO_READ_ALOUD_ENABLED,
    preferredExpressionBiasEnabled: DEFAULT_PREFERRED_EXPRESSION_BIAS_ENABLED,
    proactiveEnabled: DEFAULT_PROACTIVE_ENABLED,
    timezone: DEFAULT_TIMEZONE,
};

type DirtyField = keyof SettingsState;

const saveToLocalStorage = (state: SettingsState) => {
    try {
        window.localStorage.setItem(
            USER_SETTINGS_STORAGE_KEY,
            JSON.stringify(state)
        );
    } catch {
        // Ignore localStorage write failures and continue.
    }
};

const resolveBrowserTimeZone = (): string | null => {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
    } catch {
        return null;
    }
};

export function UserSettingsProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth();
    const userId = user?.id ?? null;
    const {
        data: remoteSettings,
        isError: isSettingsError,
        isLoading: isSettingsLoading,
        refetch: refetchSettings,
    } = useUserSettingsQuery(userId);
    const { mutateAsync: updateRemoteSettings, isPending: isSaving } =
        useUpdateUserSettingsMutation(userId);

    const [messageFontSize, setMessageFontSizeState] = useState(defaultState.messageFontSize);
    const [displayMode, setDisplayModeState] = useState<DisplayMode>(defaultState.displayMode);
    const [memoryEnabled, setMemoryEnabledState] = useState(defaultState.memoryEnabled);
    const [replyCardEnabled, setReplyCardEnabledState] = useState(defaultState.replyCardEnabled);
    const [mixedInputAutoTranslateEnabled, setMixedInputAutoTranslateEnabledState] = useState(defaultState.mixedInputAutoTranslateEnabled);
    const [autoReadAloudEnabled, setAutoReadAloudEnabledState] = useState(defaultState.autoReadAloudEnabled);
    const [preferredExpressionBiasEnabled, setPreferredExpressionBiasEnabledState] = useState(defaultState.preferredExpressionBiasEnabled);
    const [proactiveEnabled, setProactiveEnabledState] = useState(defaultState.proactiveEnabled);
    const [timezone, setTimezoneState] = useState(defaultState.timezone);

    const [hasLoadedLocalSettings, setHasLoadedLocalSettings] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [changeVersion, setChangeVersion] = useState(0);

    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const dirtyFieldsRef = useRef<Set<DirtyField>>(new Set());
    const timezoneSyncRef = useRef<string | null>(null);

    // Track the latest values for sync without stale closure issues
    const latestRef = useRef({
        messageFontSize,
        displayMode,
        memoryEnabled,
        replyCardEnabled,
        mixedInputAutoTranslateEnabled,
        autoReadAloudEnabled,
        preferredExpressionBiasEnabled,
        proactiveEnabled,
        timezone,
    });
    latestRef.current = {
        messageFontSize,
        displayMode,
        memoryEnabled,
        replyCardEnabled,
        mixedInputAutoTranslateEnabled,
        autoReadAloudEnabled,
        preferredExpressionBiasEnabled,
        proactiveEnabled,
        timezone,
    };

    const syncSettings = useCallback(async () => {
        const current = latestRef.current;
        const dirtyFields = Array.from(dirtyFieldsRef.current);
        if (dirtyFields.length === 0) {
            return;
        }

        const payload: {
            message_font_size?: number;
            display_mode?: DisplayMode;
            memory_enabled?: boolean;
            reply_card_enabled?: boolean;
            mixed_input_auto_translate_enabled?: boolean;
            auto_read_aloud_enabled?: boolean;
            preferred_expression_bias_enabled?: boolean;
            proactive_enabled?: boolean;
            timezone?: string;
        } = {};

        for (const field of dirtyFields) {
            if (field === "messageFontSize") {
                payload.message_font_size = current.messageFontSize;
            } else if (field === "displayMode") {
                payload.display_mode = current.displayMode;
            } else if (field === "memoryEnabled") {
                payload.memory_enabled = current.memoryEnabled;
            } else if (field === "replyCardEnabled") {
                payload.reply_card_enabled = current.replyCardEnabled;
            } else if (field === "mixedInputAutoTranslateEnabled") {
                payload.mixed_input_auto_translate_enabled = current.mixedInputAutoTranslateEnabled;
            } else if (field === "autoReadAloudEnabled") {
                payload.auto_read_aloud_enabled = current.autoReadAloudEnabled;
            } else if (field === "preferredExpressionBiasEnabled") {
                payload.preferred_expression_bias_enabled = current.preferredExpressionBiasEnabled;
            } else if (field === "proactiveEnabled") {
                payload.proactive_enabled = current.proactiveEnabled;
            } else if (field === "timezone") {
                payload.timezone = current.timezone;
            }
        }

        try {
            await updateRemoteSettings(payload);
            for (const field of dirtyFields) {
                dirtyFieldsRef.current.delete(field);
            }
            setError(null);
        } catch {
            setError("未同步到云端，可重试");
        }
    }, [updateRemoteSettings]);

    // Bootstrap local storage first; remote state is provided by React Query.
    useEffect(() => {
        try {
            const raw = window.localStorage.getItem(USER_SETTINGS_STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw) as Partial<SettingsState>;
                if (typeof parsed.messageFontSize === "number") {
                    setMessageFontSizeState(clampMessageFontSize(parsed.messageFontSize));
                }
                if (parsed.displayMode === "concise" || parsed.displayMode === "detailed") {
                    setDisplayModeState(parsed.displayMode);
                }
                if (typeof parsed.memoryEnabled === "boolean") {
                    setMemoryEnabledState(parsed.memoryEnabled);
                }
                if (typeof parsed.replyCardEnabled === "boolean") {
                    setReplyCardEnabledState(parsed.replyCardEnabled);
                }
                if (typeof parsed.mixedInputAutoTranslateEnabled === "boolean") {
                    setMixedInputAutoTranslateEnabledState(parsed.mixedInputAutoTranslateEnabled);
                }
                if (typeof parsed.autoReadAloudEnabled === "boolean") {
                    setAutoReadAloudEnabledState(parsed.autoReadAloudEnabled);
                }
                if (typeof parsed.preferredExpressionBiasEnabled === "boolean") {
                    setPreferredExpressionBiasEnabledState(parsed.preferredExpressionBiasEnabled);
                }
                if (typeof parsed.proactiveEnabled === "boolean") {
                    setProactiveEnabledState(parsed.proactiveEnabled);
                }
                if (typeof parsed.timezone === "string" && parsed.timezone.trim()) {
                    setTimezoneState(parsed.timezone);
                }
            }
        } catch {
            // Ignore malformed/blocked local storage reads.
        } finally {
            setHasLoadedLocalSettings(true);
        }
    }, []);

    useEffect(() => {
        const remote = remoteSettings as RemoteUserSettingsResponse | undefined;
        if (!remote || !hasLoadedLocalSettings) {
            return;
        }

        if (dirtyFieldsRef.current.size > 0) {
            return;
        }

        const nextFontSize = clampMessageFontSize(remote.message_font_size);
        const nextMemoryEnabled = typeof remote.memory_enabled === "boolean"
            ? remote.memory_enabled
            : DEFAULT_MEMORY_ENABLED;
        const nextState = {
            messageFontSize: nextFontSize,
            displayMode: remote.display_mode ?? DEFAULT_DISPLAY_MODE,
            memoryEnabled: nextMemoryEnabled,
            replyCardEnabled: remote.reply_card_enabled ?? DEFAULT_REPLY_CARD_ENABLED,
            mixedInputAutoTranslateEnabled: remote.mixed_input_auto_translate_enabled ?? DEFAULT_MIXED_INPUT_AUTO_TRANSLATE_ENABLED,
            autoReadAloudEnabled: remote.auto_read_aloud_enabled ?? DEFAULT_AUTO_READ_ALOUD_ENABLED,
            preferredExpressionBiasEnabled: remote.preferred_expression_bias_enabled ?? DEFAULT_PREFERRED_EXPRESSION_BIAS_ENABLED,
            proactiveEnabled: remote.proactive_enabled ?? DEFAULT_PROACTIVE_ENABLED,
            timezone: remote.timezone ?? DEFAULT_TIMEZONE,
        };

        setMessageFontSizeState(nextState.messageFontSize);
        setDisplayModeState(nextState.displayMode);
        setMemoryEnabledState(nextState.memoryEnabled);
        setReplyCardEnabledState(nextState.replyCardEnabled);
        setMixedInputAutoTranslateEnabledState(nextState.mixedInputAutoTranslateEnabled);
        setAutoReadAloudEnabledState(nextState.autoReadAloudEnabled);
        setPreferredExpressionBiasEnabledState(nextState.preferredExpressionBiasEnabled);
        setProactiveEnabledState(nextState.proactiveEnabled);
        setTimezoneState(nextState.timezone);
        saveToLocalStorage(nextState);
        setError(null);
    }, [hasLoadedLocalSettings, remoteSettings]);

    useEffect(() => {
        if (isSettingsError) {
            setError("设置同步失败，已使用本地配置");
        }
    }, [isSettingsError]);

    useEffect(() => {
        if (!userId || !hasLoadedLocalSettings || !remoteSettings) {
            return;
        }

        const browserTimeZone = resolveBrowserTimeZone();
        if (!browserTimeZone) {
            return;
        }

        const remote = remoteSettings as RemoteUserSettingsResponse;
        if (browserTimeZone === remote.timezone || timezoneSyncRef.current === browserTimeZone) {
            timezoneSyncRef.current = browserTimeZone;
            return;
        }

        timezoneSyncRef.current = browserTimeZone;
        setTimezoneState(browserTimeZone);
        dirtyFieldsRef.current.add("timezone");
        setChangeVersion((value) => value + 1);
    }, [hasLoadedLocalSettings, remoteSettings, userId]);

    // Persist to localStorage on every change after loading
    useEffect(() => {
        if (!hasLoadedLocalSettings) return;
        saveToLocalStorage({
            messageFontSize,
            displayMode,
            memoryEnabled,
            replyCardEnabled,
            mixedInputAutoTranslateEnabled,
            autoReadAloudEnabled,
            preferredExpressionBiasEnabled,
            proactiveEnabled,
            timezone,
        });
    }, [
        hasLoadedLocalSettings,
        messageFontSize,
        displayMode,
        memoryEnabled,
        replyCardEnabled,
        mixedInputAutoTranslateEnabled,
        autoReadAloudEnabled,
        preferredExpressionBiasEnabled,
        proactiveEnabled,
        timezone,
    ]);

    // Debounced remote sync
    useEffect(() => {
        if (changeVersion === 0) return;
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }

        debounceTimerRef.current = setTimeout(() => {
            debounceTimerRef.current = null;
            void syncSettings();
        }, SETTINGS_SYNC_DEBOUNCE_MS);

        return () => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
                debounceTimerRef.current = null;
            }
        };
    }, [changeVersion, syncSettings]);

    useEffect(() => {
        return () => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
        };
    }, []);

    const bumpVersion = useCallback(() => {
        setChangeVersion((v) => v + 1);
    }, []);

    const markDirty = useCallback((field: DirtyField) => {
        dirtyFieldsRef.current.add(field);
        bumpVersion();
    }, [bumpVersion]);

    const setMessageFontSize = useCallback((size: number) => {
        setMessageFontSizeState(clampMessageFontSize(size));
        markDirty("messageFontSize");
    }, [markDirty]);

    const setDisplayMode = useCallback((mode: DisplayMode) => {
        setDisplayModeState(mode);
        markDirty("displayMode");
    }, [markDirty]);

    const setMemoryEnabled = useCallback((enabled: boolean) => {
        setMemoryEnabledState(enabled);
        markDirty("memoryEnabled");
    }, [markDirty]);

    const setReplyCardEnabled = useCallback((enabled: boolean) => {
        setReplyCardEnabledState(enabled);
        markDirty("replyCardEnabled");
    }, [markDirty]);

    const setMixedInputAutoTranslateEnabled = useCallback((enabled: boolean) => {
        setMixedInputAutoTranslateEnabledState(enabled);
        markDirty("mixedInputAutoTranslateEnabled");
    }, [markDirty]);

    const setAutoReadAloudEnabled = useCallback((enabled: boolean) => {
        setAutoReadAloudEnabledState(enabled);
        markDirty("autoReadAloudEnabled");
    }, [markDirty]);

    const setPreferredExpressionBiasEnabled = useCallback((enabled: boolean) => {
        setPreferredExpressionBiasEnabledState(enabled);
        markDirty("preferredExpressionBiasEnabled");
    }, [markDirty]);

    const setProactiveEnabled = useCallback((enabled: boolean) => {
        setProactiveEnabledState(enabled);
        markDirty("proactiveEnabled");
    }, [markDirty]);

    const retrySync = useCallback(async () => {
        if (dirtyFieldsRef.current.size === 0) {
            await refetchSettings();
            return;
        }

        await syncSettings();
    }, [refetchSettings, syncSettings]);

    const isLoading =
        !hasLoadedLocalSettings ||
        (Boolean(userId) && isSettingsLoading && !remoteSettings);

    const contextValue = useMemo(
        () => ({
            messageFontSize,
            displayMode,
            memoryEnabled,
            replyCardEnabled,
            mixedInputAutoTranslateEnabled,
            autoReadAloudEnabled,
            preferredExpressionBiasEnabled,
            proactiveEnabled,
            timezone,
            setMessageFontSize,
            setDisplayMode,
            setMemoryEnabled,
            setReplyCardEnabled,
            setMixedInputAutoTranslateEnabled,
            setAutoReadAloudEnabled,
            setPreferredExpressionBiasEnabled,
            setProactiveEnabled,
            minMessageFontSize: MIN_MESSAGE_FONT_SIZE,
            maxMessageFontSize: MAX_MESSAGE_FONT_SIZE,
            isLoading,
            isSaving,
            error,
            retrySync,
        }),
        [
            messageFontSize, displayMode, memoryEnabled, replyCardEnabled, mixedInputAutoTranslateEnabled, autoReadAloudEnabled, preferredExpressionBiasEnabled, proactiveEnabled, timezone,
            setMessageFontSize, setDisplayMode, setMemoryEnabled, setReplyCardEnabled, setMixedInputAutoTranslateEnabled, setAutoReadAloudEnabled, setPreferredExpressionBiasEnabled, setProactiveEnabled,
            isLoading, isSaving, error, retrySync,
        ]
    );

    return (
        <UserSettingsContext.Provider value={contextValue}>
            {children}
        </UserSettingsContext.Provider>
    );
}

export function useUserSettings() {
    const context = useContext(UserSettingsContext);
    if (!context) {
        throw new Error("useUserSettings must be used within a UserSettingsProvider");
    }
    return context;
}
