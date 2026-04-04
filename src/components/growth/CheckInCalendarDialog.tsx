"use client";

import { useCallback, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useGrowth } from "@/lib/growth-context";
import { applyGrowthMakeUp, getGrowthCalendar } from "@/lib/growth-api";
import type {
  GrowthCalendarDay,
  GrowthCalendarMonth,
} from "@/lib/growth-types";
import { ChevronLeft, ChevronRight, Ticket } from "lucide-react";

const WEEKDAY_LABELS = ["一", "二", "三", "四", "五", "六", "日"];

function getMonthLabel(monthStr: string): string {
  const [year, month] = monthStr.split("-");
  return `${year} 年 ${Number(month)} 月`;
}

function getFirstDayOffset(monthStr: string): number {
  const d = new Date(`${monthStr}-01T00:00:00`);
  const day = d.getDay();
  return day === 0 ? 6 : day - 1;
}

function DayCell({
  day,
  onMakeUp,
  isMakingUp,
}: {
  day: GrowthCalendarDay;
  onMakeUp: (date: string) => void;
  isMakingUp: boolean;
}) {
  const { makeupCardBalance } = useGrowth();

  if (day.is_future) {
    return (
      <div className="flex h-10 w-10 items-center justify-center rounded-full text-sm text-[var(--text-tertiary)]">
        {day.day_of_month}
      </div>
    );
  }

  const vs = day.visual_status;

  if (vs === "natural_signed" || vs === "today_natural_signed") {
    return (
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500 text-sm font-medium text-white">
        {day.day_of_month}
      </div>
    );
  }

  if (vs === "makeup_signed" || vs === "today_makeup_signed") {
    return (
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-400/70 text-sm font-medium text-white ring-2 ring-blue-300/50 ring-offset-1">
        {day.day_of_month}
      </div>
    );
  }

  if (vs === "today_pending") {
    return (
      <div className="flex h-10 w-10 items-center justify-center rounded-full ring-2 ring-blue-400 text-sm font-medium text-blue-500">
        {day.day_of_month}
      </div>
    );
  }

  if (vs === "missed") {
    const canMakeUp = day.can_make_up && makeupCardBalance > 0;
    return (
      <button
        type="button"
        disabled={!canMakeUp || isMakingUp}
        onClick={() => canMakeUp && onMakeUp(day.date)}
        className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-medium transition-colors ${
          canMakeUp
            ? "cursor-pointer text-red-500 hover:bg-red-50 active:bg-red-100"
            : "cursor-default text-red-400/60"
        }`}
        title={canMakeUp ? "点击补签" : undefined}
      >
        <span className="text-xs">✕</span>
      </button>
    );
  }

  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-full text-sm text-[var(--text-tertiary)]">
      {day.day_of_month}
    </div>
  );
}

export default function CheckInCalendarDialog() {
  const {
    isEntryPopupVisible,
    entryPopupData,
    closeEntryPopup,
    calendarMonth,
    todaySummary,
    updateCalendarDay,
    updateMakeupCardBalance,
  } = useGrowth();

  const [displayedCalendar, setDisplayedCalendar] =
    useState<GrowthCalendarMonth | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [makingUpDate, setMakingUpDate] = useState<string | null>(null);

  const calendar = displayedCalendar ?? calendarMonth;
  const currentMonth = calendar?.month;

  const navigateMonth = useCallback(
    async (direction: -1 | 1) => {
      if (!currentMonth || isNavigating) return;
      setIsNavigating(true);
      try {
        const [y, m] = currentMonth.split("-").map(Number);
        const d = new Date(y, m - 1 + direction, 1);
        const target = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const res = await getGrowthCalendar(target);
        setDisplayedCalendar(res.calendar);
      } catch (err) {
        console.error("Failed to navigate month:", err);
      } finally {
        setIsNavigating(false);
      }
    },
    [currentMonth, isNavigating],
  );

  const handleMakeUp = useCallback(
    async (targetDate: string) => {
      if (makingUpDate) return;
      setMakingUpDate(targetDate);
      try {
        const res = await applyGrowthMakeUp(targetDate);
        updateCalendarDay(res.updated_day);
        updateMakeupCardBalance(res.makeup_card_balance);

        if (displayedCalendar) {
          setDisplayedCalendar((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              days: prev.days.map((d) =>
                d.date === targetDate ? res.updated_day : d,
              ),
            };
          });
        }
      } catch (err) {
        console.error("Make-up failed:", err);
      } finally {
        setMakingUpDate(null);
      }
    },
    [
      displayedCalendar,
      makingUpDate,
      updateCalendarDay,
      updateMakeupCardBalance,
    ],
  );

  const handleClose = useCallback(() => {
    setDisplayedCalendar(null);
    closeEntryPopup();
  }, [closeEntryPopup]);

  if (!entryPopupData || !calendar) return null;

  const offset = getFirstDayOffset(calendar.month);
  const streak = todaySummary?.current_natural_streak ?? 0;
  const balance = todaySummary?.makeup_card_balance ?? 0;

  return (
    <Dialog open={isEntryPopupVisible} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent className="max-w-[380px] rounded-2xl p-0 overflow-hidden border-0 shadow-xl">
        {/* Header gradient */}
        <div className="bg-gradient-to-br from-blue-500 to-indigo-600 px-6 pt-6 pb-5 text-white">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-white">
              {entryPopupData.slogan || "Every sentence counts."}
            </DialogTitle>
          </DialogHeader>

          <div className="mt-3 flex items-center gap-4 text-sm">
            <div className="flex flex-col items-center">
              <span className="text-2xl font-bold">{streak}</span>
              <span className="text-xs text-white/70">自然连签</span>
            </div>
            <div className="h-8 w-px bg-white/20" />
            <div className="flex items-center gap-1.5">
              <Ticket className="h-4 w-4 text-yellow-300" />
              <span className="font-medium">{balance}</span>
              <span className="text-xs text-white/70">补签卡</span>
            </div>
          </div>
        </div>

        {/* Calendar */}
        <div className="px-6 pt-4 pb-5">
          {/* Month navigation */}
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => navigateMonth(-1)}
              disabled={isNavigating}
              className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-[var(--interactive-bg-secondary-hover)] transition-colors"
            >
              <ChevronLeft className="h-4 w-4 text-[var(--text-secondary)]" />
            </button>
            <span className="text-sm font-medium text-[var(--text-primary)]">
              {currentMonth && getMonthLabel(currentMonth)}
            </span>
            <button
              type="button"
              onClick={() => navigateMonth(1)}
              disabled={isNavigating}
              className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-[var(--interactive-bg-secondary-hover)] transition-colors"
            >
              <ChevronRight className="h-4 w-4 text-[var(--text-secondary)]" />
            </button>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-y-0.5 text-center">
            {WEEKDAY_LABELS.map((label) => (
              <div
                key={label}
                className="flex h-8 items-center justify-center text-xs font-medium text-[var(--text-tertiary)]"
              >
                {label}
              </div>
            ))}

            {/* Offset blanks */}
            {Array.from({ length: offset }).map((_, i) => (
              <div key={`blank-${i}`} className="h-10 w-10" />
            ))}

            {/* Days */}
            {calendar.days.map((day) => (
              <div key={day.date} className="flex items-center justify-center">
                <DayCell
                  day={day}
                  onMakeUp={handleMakeUp}
                  isMakingUp={makingUpDate === day.date}
                />
              </div>
            ))}
          </div>

          {/* CTA */}
          <Button
            onClick={handleClose}
            className="mt-4 w-full rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white hover:from-blue-600 hover:to-indigo-700 transition-all"
          >
            Chat
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
