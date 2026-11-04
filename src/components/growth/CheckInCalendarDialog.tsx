"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { useGrowth } from "@/lib/growth-context";
import { getErrorMessage } from "@/lib/error-map";
import { toast } from "sonner";
import {
  useApplyGrowthMakeUpMutation,
  useGrowthCalendarQuery,
} from "@/lib/query";
import type {
  GrowthCalendarDay,
  GrowthCalendarMonth,
} from "@/lib/growth-types";
import { ChevronDown, ChevronLeft, ChevronRight, Ticket, X } from "lucide-react";

const WEEKDAY_LABELS = ["一", "二", "三", "四", "五", "六", "日"];
const MONTH_PICKER_OPTIONS = Array.from({ length: 12 }, (_, index) => index + 1);
const CALENDAR_GRID_CELL_COUNT = 42;

function getMonthLabel(monthStr: string): string {
  const [year, month] = monthStr.split("-");
  return `${year} 年 ${Number(month)} 月`;
}

function formatMonthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function parseMonthKey(monthStr: string): { year: number; month: number } {
  const [year, month] = monthStr.split("-").map(Number);
  return { year, month };
}

function getFirstDayOffset(monthStr: string): number {
  const d = new Date(`${monthStr}-01T00:00:00`);
  const day = d.getDay();
  return day === 0 ? 6 : day - 1;
}

function buildCalendarGridDays(calendar: GrowthCalendarMonth): Array<GrowthCalendarDay | null> {
  const leadingEmptyDays = Array.from(
    { length: getFirstDayOffset(calendar.month) },
    () => null as GrowthCalendarDay | null,
  );
  const monthDays = calendar.days.map((day) => day);
  const trailingEmptyDays = Array.from(
    {
      length: Math.max(
        0,
        CALENDAR_GRID_CELL_COUNT - leadingEmptyDays.length - monthDays.length,
      ),
    },
    () => null as GrowthCalendarDay | null,
  );

  return [...leadingEmptyDays, ...monthDays, ...trailingEmptyDays];
}

function getCalendarAnimationClass(direction: "forward" | "backward" | "jump"): string {
  if (direction === "forward") {
    return "animate-in fade-in-0 slide-in-from-right-3 duration-200";
  }

  if (direction === "backward") {
    return "animate-in fade-in-0 slide-in-from-left-3 duration-200";
  }

  return "animate-in fade-in-0 zoom-in-95 duration-200";
}

function DayCell({
  day,
  onMakeUp,
  isMakingUp,
}: {
  day: GrowthCalendarDay;
  onMakeUp: (day: GrowthCalendarDay) => void;
  isMakingUp: boolean;
}) {
  if (day.is_future) {
    return (
      <div className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-medium text-zinc-300">
        {day.day_of_month}
      </div>
    );
  }

  const vs = day.visual_status;

  if (vs === "natural_signed" || vs === "today_natural_signed") {
    return (
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-sm font-semibold text-blue-600 shadow-sm shadow-blue-500/5">
        {day.day_of_month}
      </div>
    );
  }

  if (vs === "makeup_signed" || vs === "today_makeup_signed") {
    return (
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-50 text-sm font-semibold text-orange-600 shadow-sm shadow-orange-500/5">
        {day.day_of_month}
      </div>
    );
  }

  if (vs === "today_pending") {
    return (
      <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-blue-500 bg-white text-sm font-bold text-blue-600">
        {day.day_of_month}
      </div>
    );
  }

  if (vs === "missed") {
    return (
      <button
        type="button"
        disabled={isMakingUp}
        onClick={() => onMakeUp(day)}
        className="group relative flex h-10 w-10 items-center justify-center rounded-full text-sm font-medium text-zinc-900 transition-colors hover:bg-orange-50 hover:text-orange-600 disabled:cursor-wait disabled:opacity-60"
        title="点击补签"
      >
        <span className="relative z-10">{day.day_of_month}</span>
      </button>
    );
  }

  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-medium text-zinc-400">
      {day.day_of_month}
    </div>
  );
}

export default function CheckInCalendarDialog() {
  const { user } = useAuth();
  const {
    isEntryPopupVisible,
    entryPopupData,
    closeEntryPopup,
    dismissEntryPopupForToday,
    calendarMonth,
    todaySummary,
    updateCalendarDay,
    updateMakeupCardBalance,
  } = useGrowth();

  const [displayedCalendar, setDisplayedCalendar] =
    useState<GrowthCalendarMonth | null>(null);
  const [requestedMonth, setRequestedMonth] = useState<string | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [makingUpDate, setMakingUpDate] = useState<string | null>(null);
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [pickerYearInput, setPickerYearInput] = useState("");
  const [pickerMonth, setPickerMonth] = useState<number | null>(null);
  const [calendarAnimationDirection, setCalendarAnimationDirection] =
    useState<"forward" | "backward" | "jump">("jump");
  const [calendarAnimationKey, setCalendarAnimationKey] = useState(0);

  const calendar = displayedCalendar ?? calendarMonth;
  const currentMonth = calendar?.month;
  const calendarQuery = useGrowthCalendarQuery(
    user?.id,
    requestedMonth,
    Boolean(requestedMonth),
  );
  const makeUpMutation = useApplyGrowthMakeUpMutation(user?.id);
  const calendarDays = calendar ? buildCalendarGridDays(calendar) : [];
  const streak = todaySummary?.current_natural_streak ?? 0;
  const balance = todaySummary?.makeup_card_balance ?? 0;

  const loadCalendarMonth = useCallback(
    (
      targetMonth: string,
      direction: "forward" | "backward" | "jump",
    ) => {
      if (isNavigating) return;
      setIsNavigating(true);
      setCalendarAnimationDirection(direction);
      setCalendarAnimationKey((prev) => prev + 1);
      setRequestedMonth(targetMonth);
    },
    [isNavigating],
  );

  useEffect(() => {
    if (!calendarQuery.data) {
      return;
    }

    setDisplayedCalendar(calendarQuery.data.calendar);
    setIsNavigating(false);
  }, [calendarQuery.data]);

  useEffect(() => {
    if (!calendarQuery.isError) {
      return;
    }

    setIsNavigating(false);
    toast.error("加载月份失败，请稍后重试");
  }, [calendarQuery.isError]);

  const navigateMonth = useCallback(
    async (direction: -1 | 1) => {
      if (!currentMonth) return;
      const { year, month } = parseMonthKey(currentMonth);
      const nextDate = new Date(year, month - 1 + direction, 1);
      loadCalendarMonth(
        formatMonthKey(nextDate.getFullYear(), nextDate.getMonth() + 1),
        direction > 0 ? "forward" : "backward",
      );
    },
    [currentMonth, loadCalendarMonth],
  );

  const handleJumpToMonth = useCallback(async () => {
    const parsedYear = Number(pickerYearInput.trim());
    if (
      !pickerMonth ||
      Number.isNaN(parsedYear) ||
      parsedYear < 2000 ||
      parsedYear > 2100
    ) {
      toast.error("请选择有效的年月");
      return;
    }

    const targetMonth = formatMonthKey(parsedYear, pickerMonth);
    if (targetMonth === currentMonth) {
      setMonthPickerOpen(false);
      return;
    }

    setMonthPickerOpen(false);
    loadCalendarMonth(targetMonth, "jump");
  }, [currentMonth, loadCalendarMonth, pickerMonth, pickerYearInput]);

  const handleMakeUp = useCallback(
    async (targetDay: GrowthCalendarDay) => {
      if (makingUpDate) return;

      if (balance <= 0) {
        toast.error("暂无补签卡");
        return;
      }

      if (!targetDay.can_make_up) {
        toast.error("这个日期当前不可补签");
        return;
      }

      setMakingUpDate(targetDay.date);
      try {
        const res = await makeUpMutation.mutateAsync(targetDay.date);
        updateCalendarDay(res.updated_day);
        updateMakeupCardBalance(res.makeup_card_balance);

        if (displayedCalendar) {
          setDisplayedCalendar((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              days: prev.days.map((d) =>
                d.date === targetDay.date ? res.updated_day : d,
              ),
            };
          });
        }
        toast.success("补签成功");
      } catch (err) {
        console.error("Make-up failed:", err);
        toast.error(getErrorMessage(err));
      } finally {
        setMakingUpDate(null);
      }
    },
    [
      balance,
      displayedCalendar,
      makeUpMutation,
      makingUpDate,
      updateCalendarDay,
      updateMakeupCardBalance,
    ],
  );

  const handleClose = useCallback(() => {
    setDisplayedCalendar(null);
    setRequestedMonth(null);
    setMonthPickerOpen(false);
    closeEntryPopup();
  }, [closeEntryPopup]);

  const handleDismissToday = useCallback(() => {
    setDisplayedCalendar(null);
    setRequestedMonth(null);
    setMonthPickerOpen(false);
    dismissEntryPopupForToday();
  }, [dismissEntryPopupForToday]);

  useEffect(() => {
    if (pickerYearInput === "" && currentMonth) {
      const { year, month } = parseMonthKey(currentMonth);
      if (pickerMonth !== month) {
        setPickerMonth(month);
      }
      setPickerYearInput(String(year));
    }
  }, [currentMonth]);

  if (!entryPopupData || !calendar) return null;

  const calendarAnimationClass = getCalendarAnimationClass(
    calendarAnimationDirection,
  );

  return (
    <Dialog
      open={isEntryPopupVisible}
      onOpenChange={(open) => {
        if (!open) handleClose();
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="max-w-[380px] overflow-hidden rounded-[24px] border border-zinc-100 bg-white p-0 shadow-2xl"
      >
        <div className="relative px-6 pt-5 pb-6">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-blue-50 to-white/0 opacity-80" />

          <div className="relative mb-5">
            <div className="mb-3 flex items-start justify-between gap-4">
              <DialogHeader className="text-left">
                <DialogTitle className="text-[22px] leading-tight font-bold tracking-tight text-zinc-900">
                  {entryPopupData.slogan || "Every sentence counts."}
                </DialogTitle>
              </DialogHeader>
              <DialogClose asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="size-8 rounded-lg text-gray-500 opacity-70 transition-all hover:bg-gray-100 hover:opacity-100 [&_svg]:text-black"
                >
                  <X />
                  <span className="sr-only">关闭</span>
                </Button>
              </DialogClose>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div className="flex items-baseline gap-1.5">
                <span className="text-[32px] leading-none font-black tracking-tighter text-blue-600 drop-shadow-sm">
                  {streak}
                </span>
                <span className="text-[13px] font-medium text-zinc-500">
                  天连续签到
                </span>
              </div>

              <div
                className="flex items-center gap-1.5 rounded-full border border-zinc-100 bg-zinc-50 px-2.5 py-1 shadow-sm"
                aria-label={`补签卡余额 ${balance}`}
              >
                <Ticket className="size-[13px] text-orange-500" />
                <span className="text-[14px] font-bold text-zinc-700">
                  {balance}
                </span>
                <span className="text-[11px] font-medium text-zinc-500">
                  补签卡
                </span>
              </div>
            </div>
          </div>

          <div className="mb-4 flex items-center justify-between">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => navigateMonth(-1)}
              disabled={isNavigating}
              className="rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
            >
              <ChevronLeft />
              <span className="sr-only">上一个月</span>
            </Button>
            <Popover open={monthPickerOpen} onOpenChange={setMonthPickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-8 gap-1 rounded-full px-3 text-sm font-semibold text-zinc-900 hover:bg-zinc-100"
                >
                  <span>{currentMonth && getMonthLabel(currentMonth)}</span>
                  <ChevronDown className="size-4 text-zinc-400" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[292px] rounded-2xl border-zinc-200 p-4">
                <PopoverHeader className="gap-1.5">
                  <PopoverTitle className="text-sm font-semibold text-zinc-900">
                    快捷跳转
                  </PopoverTitle>
                  <p className="text-xs text-zinc-500">选择年份和月份后立即切换</p>
                </PopoverHeader>
                <div className="mt-4 flex flex-col gap-4">
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={2000}
                      max={2100}
                      value={pickerYearInput}
                      onChange={(event) => setPickerYearInput(event.target.value)}
                      className="h-9 rounded-xl border-zinc-100 bg-zinc-50 shadow-none hover:border-zinc-100 hover:shadow-none focus-visible:border-zinc-200 focus-visible:ring-0"
                    />
                    <span className="text-sm font-medium text-zinc-500">年</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {MONTH_PICKER_OPTIONS.map((monthOption) => (
                      <Button
                        key={monthOption}
                        type="button"
                        variant={pickerMonth === monthOption ? "secondary" : "ghost"}
                        className="h-9 rounded-xl text-sm font-medium"
                        onClick={() => setPickerMonth(monthOption)}
                      >
                        {monthOption} 月
                      </Button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      className="flex-1 rounded-xl"
                      onClick={() => setMonthPickerOpen(false)}
                    >
                      取消
                    </Button>
                    <Button
                      type="button"
                      className="flex-1 rounded-xl bg-zinc-900 text-white hover:bg-zinc-800"
                      onClick={() => void handleJumpToMonth()}
                    >
                      跳转
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => navigateMonth(1)}
              disabled={isNavigating}
              className="rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
            >
              <ChevronRight />
              <span className="sr-only">下一个月</span>
            </Button>
          </div>

          <div
            key={`${currentMonth}-${calendarAnimationKey}`}
            className={cn("mb-3", calendarAnimationClass)}
          >
            <div className="grid grid-cols-7 gap-y-2 text-center">
              {WEEKDAY_LABELS.map((label) => (
                <div
                  key={label}
                  className="flex h-8 items-center justify-center text-[11px] font-medium text-zinc-400"
                >
                  {label}
                </div>
              ))}

              {calendarDays.map((day, index) =>
                day ? (
                  <div
                    key={day.date}
                    className="flex items-center justify-center"
                  >
                    <DayCell
                      day={day}
                      onMakeUp={handleMakeUp}
                      isMakingUp={makingUpDate === day.date}
                    />
                  </div>
                ) : (
                  <div key={`empty-${currentMonth}-${index}`} className="h-10 w-10" />
                ),
              )}
            </div>
          </div>

          <div className="mt-4 flex gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={handleDismissToday}
              className="h-[42px] flex-1 rounded-xl text-[14px] font-semibold text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
            >
              今日不再提示
            </Button>
            <Button
              type="button"
              onClick={handleClose}
              className="h-[42px] flex-1 rounded-xl bg-zinc-900 text-[14px] font-semibold text-white shadow-xl shadow-black/10 transition-transform hover:bg-zinc-800 active:scale-[0.98]"
            >
              继续探索
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
