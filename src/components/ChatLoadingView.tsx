"use client";

import { useMemo, useRef } from "react";
import { usePathname } from "next/navigation";

import type { Character } from "@/components/Sidebar";
import ChatHeader from "@/components/ChatHeader";
import ChatMainFrame from "@/components/layout/ChatMainFrame";
import ChatMessagesSkeleton from "@/components/chat/ChatMessagesSkeleton";
import ChatComposerPlaceholder from "@/components/chat/ChatComposerPlaceholder";
import { LoadingStatus } from "@/components/LoadingStates";
import { Skeleton } from "@/components/ui/skeleton";
import { readChatEntrySeed } from "@/lib/loading";

interface ChatLoadingViewProps {
  /** 已知角色信息（乐观导航种子） */
  character?: Character | null;
  /** 重试耗尽后的失败态；内嵌在消息区，不用浮层弹窗 */
  failure?: { message: string; onRetry: () => void };
}

/**
 * 聊天页加载态：复用真实页面的 ChatMainFrame / ChatHeader / ChatInput，
 * 因此 header、输入框的位置与真实页面零位移；只有消息区是骨架。
 *
 * 输入框不依赖任何后端数据，加载期间就直接以禁用态出现，不用灰胶囊代替。
 * 消息骨架逐层复刻 ChatMessage 的结构（见 ChatMessagesSkeleton）。
 * 三个入口（/chat/new、路由 loading.tsx、聊天页数据加载）共用本组件。
 */
export default function ChatLoadingView({
  character,
  failure,
}: ChatLoadingViewProps) {
  const pathname = usePathname();
  const scrollRootRef = useRef<HTMLDivElement | null>(null);

  // loading.tsx 拿不到 params，从路径解析 chatId 再读迁移后的种子，
  // 保证 replace 到 /chat/<id> 的那一瞬间 header 仍是真实角色。
  const resolvedCharacter = useMemo(() => {
    if (character) return character;
    const match = pathname.match(/^\/chat\/([^/]+)/);
    if (!match || match[1] === "new") return null;
    return readChatEntrySeed(match[1]);
  }, [character, pathname]);

  return (
    <div className="relative flex min-h-0 min-w-0 flex-1">
      <ChatMainFrame
        scrollRootRef={scrollRootRef}
        header={
          <div className="w-full">
            <ChatHeader
              character={resolvedCharacter}
              isNewChatDisabled
              onToggleAssistant={() => {}}
              onToggleHistory={() => {}}
              onNewChat={() => {}}
              onToggleSidebar={() => {}}
              headerAction={<Skeleton className="h-9 w-9 rounded-full" />}
            />
          </div>
        }
        thread={
          failure ? (
            <div className="flex min-h-full flex-1 items-center justify-center px-4">
              <LoadingStatus
                message={failure.message}
                onRetry={failure.onRetry}
              />
            </div>
          ) : (
            <ChatMessagesSkeleton />
          )
        }
        composer={
          <ChatComposerPlaceholder roleName={resolvedCharacter?.name} />
        }
      />
    </div>
  );
}
