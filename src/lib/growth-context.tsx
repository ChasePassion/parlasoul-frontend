"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type {
  GrowthTodaySummary,
  GrowthPopup,
  GrowthShareCard,
  GrowthCalendarMonth,
  GrowthCalendarDay,
} from "./growth-types";
import { consumeGrowthEntry, listPendingShareCards } from "./growth-api";

// ── Context shape ──

interface GrowthContextType {
  todaySummary: GrowthTodaySummary | null;

  isEntryPopupVisible: boolean;
  entryPopupData: GrowthPopup | null;
  closeEntryPopup: () => void;

  updateTodaySummary: (today: GrowthTodaySummary) => void;

  pendingShareCards: GrowthShareCard[];
  enqueueShareCard: (card: GrowthShareCard) => void;
  dismissShareCard: (triggerId: string) => void;

  makeupCardBalance: number;

  calendarMonth: GrowthCalendarMonth | null;
  updateCalendarDay: (day: GrowthCalendarDay) => void;
  updateMakeupCardBalance: (balance: number) => void;

  isLoading: boolean;
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
  const [isLoading, setIsLoading] = useState(true);

  const hasCalledRef = useRef(false);

  useEffect(() => {
    if (hasCalledRef.current) return;
    hasCalledRef.current = true;

    let cancelled = false;

    async function bootstrap() {
      try {
        const data = await consumeGrowthEntry();
        if (cancelled) return;

        setTodaySummary(data.today);
        setEntryPopupData(data.popup);
        setCalendarMonth(data.popup.calendar);

        if (data.popup.should_show) {
          setIsEntryPopupVisible(true);
        }

        try {
          const pendingRes = await listPendingShareCards({ limit: 10 });
          if (cancelled) return;
          setPendingShareCards((prev) => {
            const seen = new Set(prev.map((card) => card.id));
            const merged = [...prev];
            for (const card of pendingRes.items) {
              if (seen.has(card.id)) continue;
              seen.add(card.id);
              merged.push(card);
            }
            return merged;
          });
        } catch (pendingErr) {
          console.error("Failed to restore pending share cards:", pendingErr);
        }
      } catch (err) {
        console.error("Growth entry failed:", err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    bootstrap();

    return () => {
      cancelled = true;
    };
  }, []);

  const closeEntryPopup = useCallback(() => {
    setIsEntryPopupVisible(false);
  }, []);

  const updateTodaySummary = useCallback((today: GrowthTodaySummary) => {
    setTodaySummary(today);
  }, []);

  const enqueueShareCard = useCallback((card: GrowthShareCard) => {
    setPendingShareCards((prev) => {
      if (prev.some((c) => c.id === card.id)) return prev;
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

  return (
    <GrowthContext.Provider
      value={{
        todaySummary,
        isEntryPopupVisible,
        entryPopupData,
        closeEntryPopup,
        updateTodaySummary,
        pendingShareCards,
        enqueueShareCard,
        dismissShareCard,
        makeupCardBalance,
        calendarMonth,
        updateCalendarDay,
        updateMakeupCardBalance,
        isLoading,
      }}
    >
      {children}
    </GrowthContext.Provider>
  );
}
