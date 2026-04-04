"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getGrowthChatHeader } from "@/lib/growth-api";
import type { GrowthChatHeaderResponse } from "@/lib/growth-types";
import ReadingRingPopover from "./ReadingRingPopover";

interface ReadingRingProps {
  chatId: string;
}

const RING_SIZE = 32;
const STROKE_WIDTH = 3;
const RADIUS = (RING_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export default function ReadingRing({ chatId }: ReadingRingProps) {
  const [data, setData] = useState<GrowthChatHeaderResponse | null>(null);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [animateLoop, setAnimateLoop] = useState(false);
  const prevLoopsRef = useRef<number | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await getGrowthChatHeader(chatId);
      if (
        prevLoopsRef.current !== null &&
        res.completed_loops > prevLoopsRef.current
      ) {
        setAnimateLoop(true);
        setTimeout(() => setAnimateLoop(false), 1200);
      }
      prevLoopsRef.current = res.completed_loops;
      setData(res);
    } catch (err) {
      console.error("Failed to fetch chat header growth:", err);
    }
  }, [chatId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Provide a way for SSE updates to refresh ring data
  useEffect(() => {
    const handler = () => {
      fetchData();
    };
    window.addEventListener("growth:header:refresh", handler);
    return () => window.removeEventListener("growth:header:refresh", handler);
  }, [fetchData]);

  if (!data) return null;

  const ratio = Math.min(data.current_loop_progress_ratio, 1);
  const offset = CIRCUMFERENCE * (1 - ratio);

  return (
    <ReadingRingPopover
      data={data}
      open={isPopoverOpen}
      onOpenChange={setIsPopoverOpen}
      triggerRef={triggerRef}
    >
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsPopoverOpen((p) => !p)}
        className="relative flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
        title={`已完成 ${data.completed_loops} 轮 · 当前 ${data.current_loop_progress_words}/${data.ring_unit_words} 词`}
      >
        <svg
          width={RING_SIZE}
          height={RING_SIZE}
          viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
          className="-rotate-90"
        >
          {/* Track */}
          <circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke="var(--border)"
            strokeWidth={STROKE_WIDTH}
          />
          {/* Progress arc */}
          <circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke="#3b82f6"
            strokeWidth={STROKE_WIDTH}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={offset}
            className="transition-[stroke-dashoffset] duration-700 ease-out"
          />
        </svg>
        {/* Center text */}
        <span
          className={`absolute text-xs font-semibold tabular-nums transition-transform ${
            animateLoop
              ? "scale-125 text-blue-500"
              : "scale-100 text-[var(--text-primary)]"
          }`}
          style={{
            transitionDuration: animateLoop ? "600ms" : "300ms",
          }}
        >
          {data.completed_loops}
        </span>
        {/* +1 animation */}
        {animateLoop && (
          <span className="pointer-events-none absolute -top-1 text-xs font-bold text-blue-500 animate-reading-ring-plus-one">
            +1
          </span>
        )}
      </button>
    </ReadingRingPopover>
  );
}
