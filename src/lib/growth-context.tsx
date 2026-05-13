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
import { useAuth } from "./auth-context";
import type {
  GrowthTodaySummary,
  GrowthPopup,
  GrowthShareCard,
  GrowthCalendarMonth,
  GrowthCalendarDay,
} from "./growth-types";
import { playGrowthNotification } from "./sound";
import {
  dismissGrowthEntryForToday as persistGrowthEntryDismissal,
  getGrowthEntrySessionHandledKey,
  readGrowthEntryDismissedStatDate,
  shouldEvaluateGrowthEntryAutoOpenForSession,
  shouldAutoOpenGrowthEntryPopup,
} from "./growth-entry-prompt";
import {
  useConsumeGrowthEntryMutation,
  usePendingShareCardsQuery,
} from "./query";

// ── Context shape ──

interface GrowthContextType {
  todaySummary: GrowthTodaySummary | null;

  isEntryPopupVisible: boolean;
  entryPopupData: GrowthPopup | null;
  closeEntryPopup: () => void;
  openEntryPopup: () => Promise<void>;
  dismissEntryPopupForToday: () => void;
  refreshGrowthEntry: (options?: { autoOpenPopup?: boolean }) => Promise<void>;

  updateTodaySummary: (today: GrowthTodaySummary) => void;
  invalidateGrowthChatHeader: (userId: string, chatId: string) => void;
  registerGrowthChatHeaderInvalidator: (
    userId: string,
    chatId: string,
    invalidate: () => void,
  ) => () => void;

  pendingShareCards: GrowthShareCard[];
  enqueueShareCard: (card: GrowthShareCard) => void;
  dismissShareCard: (triggerId: string) => void;

  makeupCardBalance: number;

  calendarMonth: GrowthCalendarMonth | null;
  updateCalendarDay: (day: GrowthCalendarDay) => void;
  updateMakeupCardBalance: (balance: number) => void;
}

const GrowthContext = createContext<GrowthContextType | null>(null);

export function useGrowth(): GrowthContextType {
  const ctx = useContext(GrowthContext);
  if (!ctx) {
    throw new Error("useGrowth must be used within GrowthProvider");
  }
  return ctx;
}

// ── Provider ──

export function GrowthProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const pendingShareCardsQuery = usePendingShareCardsQuery(user?.id, {
    limit: 10,
  });
  const { mutateAsync: consumeGrowthEntry } = useConsumeGrowthEntryMutation(
    user?.id,
  );
  const [todaySummary, setTodaySummary] = useState<GrowthTodaySummary | null>(
    null,
  );
  const [isEntryPopupVisible, setIsEntryPopupVisible] = useState(false);
  const [entryPopupData, setEntryPopupData] = useState<GrowthPopup | null>(
    null,
  );
  const [pendingShareCards, setPendingShareCards] = useState<GrowthShareCard[]>(
    [],
  );
  const [calendarMonth, setCalendarMonth] =
    useState<GrowthCalendarMonth | null>(null);
  const handledAutoOpenStatDateRef = useRef<string | null>(null);
  const invalidateRegistryRef = useRef<Map<string, () => void>>(new Map());

  const readHandledAutoOpenStatDate = useCallback((userId?: string | null) => {
    if (!userId || typeof window === "undefined") {
      return null;
    }

    try {
      return (
        window.sessionStorage.getItem(getGrowthEntrySessionHandledKey(userId)) ??
        null
      );
    } catch {
      return null;
    }
  }, []);

  const persistHandledAutoOpenStatDate = useCallback(
    (statDate: string, userId?: string | null) => {
      if (!userId) {
        return;
      }

      handledAutoOpenStatDateRef.current = statDate;

      if (typeof window === "undefined") {
        return;
      }

      try {
        window.sessionStorage.setItem(
          getGrowthEntrySessionHandledKey(userId),
          statDate,
        );
      } catch {
        // Ignore storage failures and keep the popup behavior functional.
      }
    },
    [],
  );

  useEffect(() => {
    setIsEntryPopupVisible(false);
    setEntryPopupData(null);
    setCalendarMonth(null);
    setTodaySummary(null);
    invalidateRegistryRef.current.clear();
    handledAutoOpenStatDateRef.current = null;

    if (!user?.id) {
      setPendingShareCards([]);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    handledAutoOpenStatDateRef.current = readHandledAutoOpenStatDate(user.id);
  }, [readHandledAutoOpenStatDate, user?.id]);

  useEffect(() => {
    if (pendingShareCardsQuery.data) {
      setPendingShareCards(pendingShareCardsQuery.data.items);
    }
  }, [pendingShareCardsQuery.data]);

  const refreshGrowthEntry = useCallback(
    async (options?: { autoOpenPopup?: boolean }) => {
      if (!user?.id) {
        return;
      }

      const data = await consumeGrowthEntry(undefined);
      setTodaySummary(data.today);
      setEntryPopupData(data.popup);
      setCalendarMonth(data.popup.calendar);

      if (!options?.autoOpenPopup) {
        return;
      }

      const lastHandledStatDate =
        handledAutoOpenStatDateRef.current ??
        readHandledAutoOpenStatDate(user.id);
      if (
        !shouldEvaluateGrowthEntryAutoOpenForSession({
          statDate: data.today.stat_date,
          lastHandledStatDate,
        })
      ) {
        return;
      }

      persistHandledAutoOpenStatDate(data.today.stat_date, user.id);
      const dismissedStatDate = readGrowthEntryDismissedStatDate(user.id);
      setIsEntryPopupVisible(
        shouldAutoOpenGrowthEntryPopup({
          statDate: data.today.stat_date,
          dismissedStatDate,
        }),
      );
    },
    [
      consumeGrowthEntry,
      persistHandledAutoOpenStatDate,
      readHandledAutoOpenStatDate,
      user?.id,
    ],
  );

  const closeEntryPopup = useCallback(() => {
    setIsEntryPopupVisible(false);
  }, []);

  const openEntryPopup = useCallback(async () => {
    if (!entryPopupData) {
      await refreshGrowthEntry();
    }
    setIsEntryPopupVisible(true);
  }, [entryPopupData, refreshGrowthEntry]);

  const dismissEntryPopupForToday = useCallback(() => {
    if (todaySummary?.stat_date) {
      persistGrowthEntryDismissal(todaySummary.stat_date, user?.id);
    }
    setIsEntryPopupVisible(false);
  }, [todaySummary?.stat_date, user?.id]);

  const updateTodaySummary = useCallback((today: GrowthTodaySummary) => {
    setTodaySummary(today);
  }, []);

  const registerGrowthChatHeaderInvalidator = useCallback(
    (userId: string, chatId: string, invalidate: () => void) => {
      const key = `${userId}:${chatId}`;
      invalidateRegistryRef.current.set(key, invalidate);
      return () => {
        invalidateRegistryRef.current.delete(key);
      };
    },
    [],
  );

  const invalidateGrowthChatHeader = useCallback(
    (userId: string, chatId: string) => {
      const key = `${userId}:${chatId}`;
      invalidateRegistryRef.current.get(key)?.();
    },
    [],
  );

  const enqueueShareCard = useCallback((card: GrowthShareCard) => {
    setPendingShareCards((prev) => {
      if (prev.some((c) => c.id === card.id)) return prev;
      playGrowthNotification();
      return [...prev, card];
    });
  }, []);

  const dismissShareCard = useCallback((triggerId: string) => {
    setPendingShareCards((prev) => prev.filter((c) => c.id !== triggerId));
  }, []);

  const updateCalendarDay = useCallback((day: GrowthCalendarDay) => {
    setCalendarMonth((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        days: prev.days.map((d) => (d.date === day.date ? day : d)),
      };
    });
  }, []);

  const updateMakeupCardBalance = useCallback((balance: number) => {
    setTodaySummary((prev) =>
      prev ? { ...prev, makeup_card_balance: balance } : prev,
    );
  }, []);

  const makeupCardBalance = todaySummary?.makeup_card_balance ?? 0;

  const growthContextValue = useMemo(
    () => ({
      todaySummary,
      isEntryPopupVisible,
      entryPopupData,
      closeEntryPopup,
      openEntryPopup,
      dismissEntryPopupForToday,
      refreshGrowthEntry,
      updateTodaySummary,
      invalidateGrowthChatHeader,
      registerGrowthChatHeaderInvalidator,
      pendingShareCards,
      enqueueShareCard,
      dismissShareCard,
      makeupCardBalance,
      calendarMonth,
      updateCalendarDay,
      updateMakeupCardBalance,
    }),
    [
      todaySummary,
      isEntryPopupVisible,
      entryPopupData,
      closeEntryPopup,
      openEntryPopup,
      dismissEntryPopupForToday,
      refreshGrowthEntry,
      updateTodaySummary,
      invalidateGrowthChatHeader,
      registerGrowthChatHeaderInvalidator,
      pendingShareCards,
      enqueueShareCard,
      dismissShareCard,
      makeupCardBalance,
      calendarMonth,
      updateCalendarDay,
      updateMakeupCardBalance,
    ],
  );

  return (
    <GrowthContext.Provider value={growthContextValue}>
      {children}
    </GrowthContext.Provider>
  );
}
