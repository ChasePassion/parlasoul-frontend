"use client";

import { Skeleton } from "@/components/ui/skeleton";

/**
 * 消息区骨架：按真实对话的一来一回布局，逐层复刻 ChatMessage 的 DOM。
 *  - 角色消息：左头像 36px + 左气泡 + 操作行
 *  - 用户消息：flex-row-reverse，右气泡 + 右头像
 * 容器宽度、间距、顶部留白都与真实消息一致，内容到达时零位移。
 */
export default function ChatMessagesSkeleton() {
  return (
    <div className="w-full px-3 sm:px-4 lg:px-0">
      <div className="mx-auto w-full max-w-[44rem] lg:max-w-[calc(100%-320px)]">
        {/* 角色消息（greeting 同样的顶部留白） */}
        <div className="pt-[36px]">
          <div className="relative flex w-full min-w-0 flex-col">
            <div className="flex max-w-full items-start gap-3">
              <Skeleton className="h-9 w-9 shrink-0 rounded-lg" />
              <div className="flex min-w-0 max-w-[70%] flex-col">
                <Skeleton className="h-9 w-[320px] max-w-full rounded-[10px]" />
                <div className="mt-1 flex h-8 w-full items-center gap-1">
                  <Skeleton className="h-6 w-6 rounded-md" />
                  <Skeleton className="h-6 w-6 rounded-md" />
                  <Skeleton className="h-6 w-6 rounded-md" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 用户消息：右对齐，无操作行 */}
        <div className="pt-3">
          <div className="relative flex w-full min-w-0 flex-col">
            <div className="flex max-w-full flex-row-reverse items-start gap-3">
              <Skeleton className="h-9 w-9 shrink-0 rounded-lg" />
              <div className="flex w-[70%] min-w-0 flex-col items-end">
                <Skeleton className="h-9 w-[80px] rounded-[10px]" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
