"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { useDelayedLoading } from "@/hooks/useDelayedLoading";

/**
 * 通用路由骨架：标题 + 内容行。
 * 形状与常见列表/详情页一致，用于 1–5s 的中等等待。
 */
export function RouteSkeleton({
  className,
  lines = 4,
}: {
  className?: string;
  lines?: number;
}) {
  return (
    <div className={cn("w-full", className)} aria-label="正在加载" role="status">
      <div className="mb-8 flex items-center gap-4">
        <Skeleton className="h-12 w-12 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      <div className="space-y-3">
        {Array.from({ length: lines }).map((_, index) => (
          <Skeleton
            key={index}
            className={cn("h-16 w-full rounded-2xl", index === lines - 1 && "w-3/4")}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * 长等待 / 失败态：分阶段状态文案 + 可重试入口。
 * 指示器延迟 200ms 出现且保持最短展示时长，避免快响应时闪烁。
 * 只用于真实可度量的长流程或失败，不用固定时长动画伪造进度。
 */
export function LoadingStatus({
  message,
  detail,
  onRetry,
  className,
  pending = false,
}: {
  message: string;
  detail?: string;
  onRetry?: () => void;
  className?: string;
  pending?: boolean;
}) {
  const { showIndicator } = useDelayedLoading(pending && !onRetry);

  return (
    <div className={cn("flex flex-col items-center gap-3 text-center", className)} role="status">
      {onRetry ? (
        <p className="text-sm text-gray-600">{message}</p>
      ) : (
        <div className="flex items-center gap-2 text-sm text-gray-600">
          {showIndicator ? (
            <Loader2 className="h-4 w-4 animate-spin text-[#0285FF]" aria-hidden="true" />
          ) : (
            <span className="h-1.5 w-1.5 rounded-full bg-[#0285FF]" aria-hidden="true" />
          )}
          <span>{message}</span>
        </div>
      )}
      {detail && <p className="text-xs text-gray-400">{detail}</p>}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-1 h-9 rounded-lg bg-black px-4 text-sm font-medium text-white hover:bg-gray-800"
        >
          重试
        </button>
      )}
    </div>
  );
}
