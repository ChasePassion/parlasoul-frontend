"use client";

import { useEffect, useId, useRef, type KeyboardEvent, type RefObject } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface TourCardProps {
  title: string;
  description: string;
  phaseLabel: string;
  current: number;
  total: number;
  isHint: boolean;
  isFirst: boolean;
  primaryLabel: string;
  onNext: () => void;
  onPrevious: () => void;
  onSkip: () => void;
  onDismissHint: () => void;
  onPause: () => void;
  cardRef: RefObject<HTMLDivElement | null>;
  reducedMotion: boolean;
}

const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export default function TourCard({
  title,
  description,
  phaseLabel,
  current,
  total,
  isHint,
  isFirst,
  primaryLabel,
  onNext,
  onPrevious,
  onSkip,
  onDismissHint,
  onPause,
  cardRef,
  reducedMotion,
}: TourCardProps) {
  const titleId = useId();
  const descriptionId = useId();
  const primaryRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    primaryRef.current?.focus({ preventScroll: true });
  }, [title]);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      if (isHint) {
        onDismissHint();
      } else {
        onPause();
      }
      return;
    }

    if (event.key === "ArrowRight" && !isHint) {
      event.preventDefault();
      onNext();
      return;
    }

    if (event.key === "ArrowLeft" && !isHint && !isFirst) {
      event.preventDefault();
      onPrevious();
      return;
    }

    if (event.key !== "Tab") {
      return;
    }

    const container = cardRef.current;
    if (!container) {
      return;
    }

    const focusables = Array.from(
      container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
    ).filter(
      (element) =>
        element.offsetParent !== null || element === document.activeElement,
    );

    if (focusables.length === 0) {
      return;
    }

    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement as HTMLElement | null;

    if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
      return;
    }

    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
      return;
    }

    if (!active || !container.contains(active)) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      ref={cardRef}
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onKeyDown={handleKeyDown}
      className={cn(
        "relative z-10 w-full rounded-2xl border border-white/70 bg-white/95 p-4 text-left shadow-[0_24px_60px_-12px_rgba(13,13,13,0.18),0_8px_24px_-8px_rgba(57,100,254,0.18)] backdrop-blur-xl sm:p-5",
        !reducedMotion && "animate-in fade-in slide-in-from-bottom-1 duration-200",
      )}
    >
      <div className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-[#3964FE]/50 to-transparent" />

      {!isHint && (
        <div className="flex items-center justify-between gap-3">
          <span className="text-[11px] font-semibold tracking-[0.08em] text-[#3964FE]">
            {phaseLabel}
          </span>
          <span className="text-[11px] tabular-nums text-[#8F8F8F]">
            {`${current} / ${total}`}
          </span>
        </div>
      )}

      {!isHint && (
        <div className="mt-2 flex items-center gap-1" aria-hidden="true">
          {Array.from({ length: total }).map((_, index) => (
            <span
              key={index}
              className={cn(
                "h-[3px] rounded-full",
                reducedMotion ? "" : "transition-all duration-200 ease-out",
                index === current - 1
                  ? "w-4 bg-[#3964FE]"
                  : "w-1.5 bg-[#E5E7EB]",
              )}
            />
          ))}
        </div>
      )}

      <h2
        id={titleId}
        className={cn(
          "text-[16px] font-semibold leading-[1.4] text-[#0D0D0D]",
          isHint ? "" : "mt-3",
        )}
      >
        {title}
      </h2>
      <p
        id={descriptionId}
        className="mt-1.5 text-[13.5px] font-[350] leading-[1.65] text-[#5D5D5D]"
      >
        {description}
      </p>

      <div className="mt-4 flex items-center justify-between gap-3">
        <div>
          {!isHint && (
            <button
              type="button"
              onClick={onSkip}
              className="rounded-md px-1 py-1 text-[12.5px] text-[#8F8F8F] transition-colors hover:text-[#5D5D5D] focus-visible:outline-none focus-visible:ring-0"
            >
              跳过
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {!isHint && !isFirst && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onPrevious}
              className="h-8 rounded-[10px] bg-[#F5F5F5] px-3 text-[13px] font-medium text-[#5D5D5D] shadow-none hover:bg-[#EDEDED] focus-visible:border-transparent focus-visible:ring-0"
            >
              上一步
            </Button>
          )}
          <Button
            ref={primaryRef}
            type="button"
            size="sm"
            onClick={isHint ? onDismissHint : onNext}
            className="h-8 rounded-[10px] bg-[#3964FE] px-3.5 text-[13px] font-medium text-white shadow-none hover:bg-[#2F55E0] active:scale-[0.98] focus-visible:border-transparent focus-visible:ring-0"
          >
            {primaryLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
