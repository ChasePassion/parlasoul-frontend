"use client";

import type { ReactNode, RefObject } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { GrowthChatHeaderResponse } from "@/lib/growth-types";
import { BookOpen, Calendar, MessageSquare, Repeat } from "lucide-react";

interface ReadingRingPopoverProps {
  data: GrowthChatHeaderResponse;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  triggerRef: RefObject<HTMLButtonElement | null>;
  children: ReactNode;
}

function StatRow({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex items-center gap-2.5 py-1">
      <span className="text-[var(--text-tertiary)]">{icon}</span>
      <span className="flex-1 text-xs text-[var(--text-secondary)]">
        {label}
      </span>
      <span className="text-xs font-medium tabular-nums text-[var(--text-primary)]">
        {value}
      </span>
    </div>
  );
}

export default function ReadingRingPopover({
  data,
  open,
  onOpenChange,
  children,
}: ReadingRingPopoverProps) {
  const cs = data.character_summary;
  const re = cs.total_reading_equivalent;

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="end"
        className="w-64 rounded-xl p-0 shadow-lg"
      >
        {/* Header */}
        <div className="border-b px-4 py-3">
          <p className="text-sm font-semibold text-[var(--text-primary)]">
            {cs.character_name}
          </p>
          <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">
            当前这一轮 {data.current_loop_progress_words}/{data.ring_unit_words} 词
          </p>
        </div>

        {/* Stats */}
        <div className="px-4 py-2">
          <StatRow
            icon={<MessageSquare className="h-3.5 w-3.5" />}
            label="累计消息数"
            value={cs.total_message_count.toLocaleString()}
          />
          <StatRow
            icon={<BookOpen className="h-3.5 w-3.5" />}
            label="累计词数"
            value={cs.total_word_count.toLocaleString()}
          />
          <StatRow
            icon={<Calendar className="h-3.5 w-3.5" />}
            label="共聊天数"
            value={cs.chatted_days_count}
          />
          <StatRow
            icon={<Repeat className="h-3.5 w-3.5" />}
            label="往来次数"
            value={cs.total_exchange_count}
          />
        </div>

        {/* Reading equivalent */}
        <div className="border-t px-4 py-2.5">
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-[var(--text-tertiary)]">
            相当于:
          </p>
          <div className="flex gap-4 text-xs">
            <div>
              <span className="font-semibold text-blue-500">
                {re.cet4_equivalent}
              </span>
              <span className="ml-1 text-[var(--text-tertiary)]">篇四级阅读</span>
            </div>
            <div>
              <span className="font-semibold text-indigo-500">
                {re.cet6_equivalent}
              </span>
              <span className="ml-1 text-[var(--text-tertiary)]">篇六级阅读</span>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
