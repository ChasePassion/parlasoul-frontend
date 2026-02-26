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
import { getMySettings, updateMySettings } from "@/lib/api";
import type { DisplayMode } from "@/lib/api";

const USER_SETTINGS_STORAGE_KEY = "user_settings_v2";
const DEFAULT_MESSAGE_FONT_SIZE = 16;
const MIN_MESSAGE_FONT_SIZE = 14;
const MAX_MESSAGE_FONT_SIZE = 24;
const DEFAULT_DISPLAY_MODE: DisplayMode = "concise";
const DEFAULT_KNOWLEDGE_CARD_ENABLED = true;
const DEFAULT_MIXED_INPUT_AUTO_TRANSLATE_ENABLED = true;
const DEFAULT_AUTO_READ_ALOUD_ENABLED = true;
const SETTINGS_SYNC_DEBOUNCE_MS = 400;

interface SettingsState {
    messageFontSize: number;
    displayMode: DisplayMode;
    knowledgeCardEnabled: boolean;
    mixedInputAutoTranslateEnabled: boolean;
    autoReadAloudEnabled: boolean;
}

interface UserSettingsContextType extends SettingsState {
    setMessageFontSize: (size: number) => void;
    setDisplayMode: (mode: DisplayMode) => void;
    setKnowledgeCardEnabled: (enabled: boolean) => void;
    setMixedInputAutoTranslateEnabled: (enabled: boolean) => void;
    setAutoReadAloudEnabled: (enabled: boolean) => void;
    minMessageFontSize: number;
    maxMessageFontSize: number;
    isLoading: boolean;
    isSaving: boolean;
    error: string | null;
    retrySync: () => Promise<void>;
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
    knowledgeCardEnabled: DEFAULT_KNOWLEDGE_CARD_ENABLED,
    mixedInputAutoTranslateEnabled: DEFAULT_MIXED_INPUT_AUTO_TRANSLATE_ENABLED,
    autoReadAloudEnabled: DEFAULT_AUTO_READ_ALOUD_ENABLED,
};

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

export function UserSettingsProvider({ children }: { children: ReactNode }) {
    const [messageFontSize, setMessageFontSizeState] = useState(defaultState.messageFontSize);
    const [displayMode, setDisplayModeState] = useState<DisplayMode>(defaultState.displayMode);
    const [knowledgeCardEnabled, setKnowledgeCardEnabledState] = useState(defaultState.knowledgeCardEnabled);
    const [mixedInputAutoTranslateEnabled, setMixedInputAutoTranslateEnabledState] = useState(defaultState.mixedInputAutoTranslateEnabled);
    const [autoReadAloudEnabled, setAutoReadAloudEnabledState] = useState(defaultState.autoReadAloudEnabled);

    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [changeVersion, setChangeVersion] = useState(0);

    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Track the latest values for sync without stale closure issues
    const latestRef = useRef({ messageFontSize, displayMode, knowledgeCardEnabled, mixedInputAutoTranslateEnabled, autoReadAloudEnabled });
    latestRef.current = { messageFontSize, displayMode, knowledgeCardEnabled, mixedInputAutoTranslateEnabled, autoReadAloudEnabled };

    const syncSettings = useCallback(async () => {
        const current = latestRef.current;
        setIsSaving(true);
        try {
            await updateMySettings({
                message_font_size: current.messageFontSize,
                display_mode: current.displayMode,
                knowledge_card_enabled: current.knowledgeCardEnabled,
                mixed_input_auto_translate_enabled: current.mixedInputAutoTranslateEnabled,
                auto_read_aloud_enabled: current.autoReadAloudEnabled,
            });
            setError(null);
        } catch {
            setError("未同步到云端，可重试");
        } finally {
            setIsSaving(false);
        }
    }, []);

    // Bootstrap: load from localStorage then remote
    useEffect(() => {
        let cancelled = false;

        const bootstrap = async () => {
            // 1. Local storage (instant)
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
                    if (typeof parsed.knowledgeCardEnabled === "boolean") {
                        setKnowledgeCardEnabledState(parsed.knowledgeCardEnabled);
                    }
                    if (typeof parsed.mixedInputAutoTranslateEnabled === "boolean") {
                        setMixedInputAutoTranslateEnabledState(parsed.mixedInputAutoTranslateEnabled);
                    }
                    if (typeof parsed.autoReadAloudEnabled === "boolean") {
                        setAutoReadAloudEnabledState(parsed.autoReadAloudEnabled);
                    }
                }
            } catch {
                // Ignore malformed/blocked local storage reads.
            }

            // 2. Remote
            try {
                const remote = await getMySettings();
                if (!cancelled) {
                    const nextFontSize = clampMessageFontSize(remote.message_font_size);
                    setMessageFontSizeState(nextFontSize);
                    setDisplayModeState(remote.display_mode ?? DEFAULT_DISPLAY_MODE);
                    setKnowledgeCardEnabledState(remote.knowledge_card_enabled ?? DEFAULT_KNOWLEDGE_CARD_ENABLED);
                    setMixedInputAutoTranslateEnabledState(remote.mixed_input_auto_translate_enabled ?? DEFAULT_MIXED_INPUT_AUTO_TRANSLATE_ENABLED);
                    setAutoReadAloudEnabledState(remote.auto_read_aloud_enabled ?? DEFAULT_AUTO_READ_ALOUD_ENABLED);
                    saveToLocalStorage({
                        messageFontSize: nextFontSize,
                        displayMode: remote.display_mode ?? DEFAULT_DISPLAY_MODE,
                        knowledgeCardEnabled: remote.knowledge_card_enabled ?? DEFAULT_KNOWLEDGE_CARD_ENABLED,
                        mixedInputAutoTranslateEnabled: remote.mixed_input_auto_translate_enabled ?? DEFAULT_MIXED_INPUT_AUTO_TRANSLATE_ENABLED,
                        autoReadAloudEnabled: remote.auto_read_aloud_enabled ?? DEFAULT_AUTO_READ_ALOUD_ENABLED,
                    });
                    setError(null);
                }
            } catch {
                if (!cancelled) {
                    setError("设置同步失败，已使用本地配置");
                }
            } finally {
                if (!cancelled) {
                    setIsLoading(false);
                }
            }
        };

        void bootstrap();

        return () => {
            cancelled = true;
        };
    }, []);

    // Persist to localStorage on every change after loading
    useEffect(() => {
        if (isLoading) return;
        saveToLocalStorage({ messageFontSize, displayMode, knowledgeCardEnabled, mixedInputAutoTranslateEnabled, autoReadAloudEnabled });
    }, [isLoading, messageFontSize, displayMode, knowledgeCardEnabled, mixedInputAutoTranslateEnabled, autoReadAloudEnabled]);

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

    const setMessageFontSize = useCallback((size: number) => {
        setMessageFontSizeState(clampMessageFontSize(size));
        bumpVersion();
    }, [bumpVersion]);

    const setDisplayMode = useCallback((mode: DisplayMode) => {
        setDisplayModeState(mode);
        bumpVersion();
    }, [bumpVersion]);

    const setKnowledgeCardEnabled = useCallback((enabled: boolean) => {
        setKnowledgeCardEnabledState(enabled);
        bumpVersion();
    }, [bumpVersion]);

    const setMixedInputAutoTranslateEnabled = useCallback((enabled: boolean) => {
        setMixedInputAutoTranslateEnabledState(enabled);
        bumpVersion();
    }, [bumpVersion]);

    const setAutoReadAloudEnabled = useCallback((enabled: boolean) => {
        setAutoReadAloudEnabledState(enabled);
        bumpVersion();
    }, [bumpVersion]);

    const retrySync = useCallback(async () => {
        await syncSettings();
    }, [syncSettings]);

    const contextValue = useMemo(
        () => ({
            messageFontSize,
            displayMode,
            knowledgeCardEnabled,
            mixedInputAutoTranslateEnabled,
            autoReadAloudEnabled,
            setMessageFontSize,
            setDisplayMode,
            setKnowledgeCardEnabled,
            setMixedInputAutoTranslateEnabled,
            setAutoReadAloudEnabled,
            minMessageFontSize: MIN_MESSAGE_FONT_SIZE,
            maxMessageFontSize: MAX_MESSAGE_FONT_SIZE,
            isLoading,
            isSaving,
            error,
            retrySync,
        }),
        [
            messageFontSize, displayMode, knowledgeCardEnabled, mixedInputAutoTranslateEnabled, autoReadAloudEnabled,
            setMessageFontSize, setDisplayMode, setKnowledgeCardEnabled, setMixedInputAutoTranslateEnabled, setAutoReadAloudEnabled,
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
