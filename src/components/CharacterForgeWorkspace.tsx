"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  BookOpen,
  Brain,
  Check,
  ChevronRight,
  FileText,
  Image as ImageIcon,
  Loader2,
  Mic,
  Pencil,
  Search,
  UserPlus,
  Wrench,
  X,
} from "lucide-react";

import ChatHeader from "@/components/ChatHeader";
import ChatInput from "@/components/ChatInput";
import { ImageGrid } from "@/components/ChatMessage";
import { ImageLightbox } from "@/components/ImageLightbox";
import ChatHistorySidebar, {
  type ChatHistoryRow,
} from "@/components/chat/ChatHistorySidebar";
import CharacterChatDialog from "@/components/CharacterChatDialog";
import Markdown from "@/components/Markdown";
import ChatMainFrame from "@/components/layout/ChatMainFrame";
import ForgeCharacterCard from "@/components/ForgeCharacterCard";
import ForgeVoicePreviewCard from "@/components/ForgeVoicePreviewCard";
import {
  useCharacterForge,
  type ForgeToolEvent,
} from "@/hooks/useCharacterForge";
import type {
  ChatImageRef,
  ForgeCharacterPayload,
  ForgeUiPayload,
} from "@/lib/api";
import { resolveCharacterAvatarSrc } from "@/lib/character-avatar";

interface CharacterForgeWorkspaceProps {
  onManualCreate: () => void;
  onToggleSidebar?: () => void;
}

/** Distance from the bottom that still counts as "at bottom". */
const BOTTOM_EPSILON_PX = 48;

function isAtBottom(node: HTMLDivElement): boolean {
  return (
    node.scrollHeight - node.clientHeight - node.scrollTop <= BOTTOM_EPSILON_PX
  );
}

const EXAMPLE_PROMPTS = [
  "在伦敦修古籍的中年女性",
  "会写歌的地下乐队鼓手",
  "说话很冲但心软的急诊科医生",
  "基于真实历史人物做改编",
];

const TOOL_ICONS: Record<string, typeof Wrench> = {
  load_skill: BookOpen,
  preview_voice: Mic,
  generate_avatar: ImageIcon,
  create_character: UserPlus,
  update_character: Pencil,
  search_web: Search,
  read_webpage: FileText,
};

function ThoughtPart({ text, active }: { text: string; active: boolean }) {
  return (
    <details open={active} className="group w-full">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 text-[13px] text-gray-500 transition-colors hover:text-gray-700 [&::-webkit-details-marker]:hidden">
        <Brain className={`h-3.5 w-3.5 ${active ? "animate-pulse" : ""}`} />
        {active ? "正在思考" : "思考过程"}
        <ChevronRight className="h-3.5 w-3.5 transition-transform group-open:rotate-90" />
      </summary>
      <div className="mt-2 max-h-56 overflow-y-auto whitespace-pre-wrap border-l-2 border-gray-200 pl-3 text-[13px] leading-6 text-gray-500">
        {text}
      </div>
    </details>
  );
}

function ToolEventRow({ event }: { event: ForgeToolEvent }) {
  const Icon = TOOL_ICONS[event.tool] ?? Wrench;
  return (
    <div className="inline-flex max-w-full items-center gap-2 self-start text-[13px] text-gray-500">
      <Icon className="h-3.5 w-3.5 shrink-0 text-gray-400" />
      <span className="truncate">
        {event.status === "running" ? event.label : (event.summary ?? event.label)}
      </span>
      {event.status === "running" ? (
        <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
      ) : event.status === "error" ? (
        <X className="h-3.5 w-3.5 shrink-0 text-red-500" />
      ) : (
        <Check className="h-3.5 w-3.5 shrink-0 text-green-600" />
      )}
    </div>
  );
}

export default function CharacterForgeWorkspace({
  onManualCreate,
  onToggleSidebar,
}: CharacterForgeWorkspaceProps) {
  const router = useRouter();
  const {
    sessions,
    activeSessionId,
    messages,
    isStreaming,
    error,
    isLoading,
    createdChatId,
    publishingCharacterId,
    send,
    stop,
    publishCreatedCharacter,
    newSession,
    openSession,
    removeSession,
    renameSession,
    clearError,
  } = useCharacterForge();

  const [isHistoryOpen, setHistoryOpen] = useState(false);
  const [showBackToBottom, setShowBackToBottom] = useState(false);
  const [lightbox, setLightbox] = useState<{
    images: ChatImageRef[];
    index: number;
  } | null>(null);
  const [chatDialog, setChatDialog] = useState<{
    chatId: string;
    name: string;
    avatar: string;
  } | null>(null);
  const scrollRootRef = useRef<HTMLDivElement | null>(null);
  const setComposerTextRef = useRef<((text: string) => void) | null>(null);
  const followingRef = useRef(true);

  const forgeCharacter = useMemo(
    () => ({
      id: "character-forge",
      name: "AI 创建角色",
      description: "告诉我你想要什么样的角色",
      avatar: "/icon.svg",
    }),
    [],
  );

  const historyRows = useMemo<ChatHistoryRow[]>(
    () =>
      sessions.map((session) => ({
        id: session.id,
        title: session.title,
        timestamp: session.updated_at ?? null,
      })),
    [sessions],
  );

  const setFollowing = useCallback((value: boolean) => {
    followingRef.current = value;
    setShowBackToBottom((prev) => (prev === !value ? prev : !value));
  }, []);

  const scrollToBottom = () => {
    const node = scrollRootRef.current;
    if (node) node.scrollTop = node.scrollHeight;
    setFollowing(true);
  };

  // A wheel/touch gesture releases following synchronously, before the scroll
  // event is dispatched. Otherwise a streaming commit landing in the same frame
  // would stick to bottom with a stale following=true and swallow the scroll.
  useEffect(() => {
    const node = scrollRootRef.current;
    if (!node) return;

    let lastTouchY: number | null = null;
    const handleWheel = (event: WheelEvent) => {
      if (event.deltaY < 0 && node.scrollHeight > node.clientHeight) {
        setFollowing(false);
      } else if (event.deltaY > 0 && isAtBottom(node)) {
        setFollowing(true);
      }
    };
    const handleTouchStart = (event: TouchEvent) => {
      lastTouchY = event.touches[0]?.clientY ?? null;
    };
    const handleTouchMove = (event: TouchEvent) => {
      const clientY = event.touches[0]?.clientY;
      if (
        lastTouchY !== null &&
        clientY !== undefined &&
        clientY > lastTouchY
      ) {
        setFollowing(false);
      }
      lastTouchY = clientY ?? null;
    };
    const handleScroll = () => {
      setFollowing(isAtBottom(node));
    };

    node.addEventListener("wheel", handleWheel, { passive: true });
    node.addEventListener("touchstart", handleTouchStart, { passive: true });
    node.addEventListener("touchmove", handleTouchMove, { passive: true });
    node.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      node.removeEventListener("wheel", handleWheel);
      node.removeEventListener("touchstart", handleTouchStart);
      node.removeEventListener("touchmove", handleTouchMove);
      node.removeEventListener("scroll", handleScroll);
    };
  }, [setFollowing]);

  // Only follow the stream while the user is at the bottom; streaming deltas
  // must never pull the reading position back.
  useEffect(() => {
    const node = scrollRootRef.current;
    if (!node || !followingRef.current) return;
    node.scrollTop = node.scrollHeight;
  }, [messages]);

  // Opening another session re-anchors to the latest message.
  useEffect(() => {
    setFollowing(true);
    const node = scrollRootRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [activeSessionId, setFollowing]);

  const startChat = (chatId: string) => {
    router.push(`/chat/${chatId}`);
  };

  const openChatDialog = (payload: ForgeCharacterPayload) => {
    const chatId = payload.chat_id ?? createdChatId;
    if (!chatId) return;
    setChatDialog({
      chatId,
      name: payload.name,
      avatar: resolveCharacterAvatarSrc(
        { name: payload.name, avatar_image_key: payload.avatar_image_key ?? null },
        "md",
      ),
    });
  };

  const renderPayload = (payload: ForgeUiPayload) => {
    if (payload.type === "voice_preview") {
      return (
        <ForgeVoicePreviewCard
          key={`${payload.preview_id}-${payload.display_name}`}
          payload={payload}
        />
      );
    }
    return (
      <ForgeCharacterCard
        key={`${payload.type}-${payload.character_id}`}
        payload={payload}
        fallbackChatId={createdChatId}
        onStartChat={startChat}
        onOpenChat={openChatDialog}
        onPublish={() => void publishCreatedCharacter()}
        isPublishing={publishingCharacterId === payload.character_id}
        onRequestAvatar={() =>
          void send("给这个角色生成一张头像，保持和角色身份一致。")
        }
        isRequestingAvatar={isStreaming}
      />
    );
  };

  const header = (
    <ChatHeader
      character={forgeCharacter}
      hideIdentity
      onToggleSidebar={onToggleSidebar}
      onNewChat={() => void newSession()}
      isNewChatDisabled={isStreaming}
      onToggleHistory={() => setHistoryOpen(true)}
      isHistoryOpen={isHistoryOpen}
      headerAction={
        <button
          type="button"
          onClick={onManualCreate}
          className="h-9 rounded-lg border border-divider bg-white px-3 text-[13px] text-gray-700 transition-colors hover:bg-sidebar-hover"
        >
          手动创建
        </button>
      }
    />
  );

  const thread = (
    <div className="mx-auto flex w-full max-w-[44rem] flex-col gap-6 px-4 pb-4 pt-6">
      {isLoading ? (
        <div className="flex flex-col gap-3" aria-label="正在加载对话">
          <div className="h-4 w-32 animate-pulse rounded bg-black/[0.06]" />
          <div className="h-4 w-full max-w-[28rem] animate-pulse rounded bg-black/[0.06]" />
          <div className="h-4 w-4/5 max-w-[24rem] animate-pulse rounded bg-black/[0.06]" />
        </div>
      ) : null}

      {messages.map((message) => {
        if (message.role === "user") {
          return (
            <div key={message.id} className="flex w-full flex-col items-end">
              {message.images.length > 0 ? (
                <ImageGrid
                  images={message.images}
                  justifyEnd
                  onImageClick={(index) =>
                    setLightbox({ images: message.images, index })
                  }
                />
              ) : null}
              <div className="bubble-user max-w-[80%] px-4 py-2 text-sm leading-6 text-text-primary">
                <p className="whitespace-pre-wrap">{message.content}</p>
              </div>
              {message.steerStatus === "queued" ? (
                <div className="mt-1 pr-1 text-[11px] text-gray-400">
                  等待应用到当前对话
                </div>
              ) : message.steerStatus === "discarded" ? (
                <div className="mt-1 pr-1 text-[11px] text-red-400">
                  未应用
                </div>
              ) : null}
            </div>
          );
        }

        const isWaiting = message.streaming && message.parts.length === 0;

        return (
          <div key={message.id} className="flex w-full min-w-0 flex-col gap-3">
            {message.parts.map((part, index) => {
              if (part.type === "thought") {
                return (
                  <ThoughtPart
                    key={`thought-${index}`}
                    text={part.text}
                    active={Boolean(
                      message.streaming && index === message.parts.length - 1,
                    )}
                  />
                );
              }
              if (part.type === "tool") {
                return <ToolEventRow key={part.event.id} event={part.event} />;
              }
              if (part.type === "content") {
                return (
                  <div
                    key={`content-${index}`}
                    className="w-full text-sm leading-7 text-text-primary"
                  >
                    <Markdown content={part.text} variant="assistant" />
                  </div>
                );
              }
              return (
                <div key={`payload-${index}`} className="w-full">
                  {renderPayload(part.payload)}
                </div>
              );
            })}

            {isWaiting ? (
              <div className="inline-flex items-center gap-2 text-[13px] text-gray-500">
                <Brain className="h-3.5 w-3.5 animate-pulse" />
                正在思考
              </div>
            ) : null}
          </div>
        );
      })}

      {!isLoading && messages.length <= 1 && !isStreaming ? (
        <div className="flex flex-wrap gap-2">
          {EXAMPLE_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => setComposerTextRef.current?.(prompt)}
              className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs text-gray-600 transition-colors hover:bg-black/[0.03]"
            >
              {prompt}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );

  const composer = (
    <>
      {showBackToBottom ? (
        <button
          type="button"
          onClick={scrollToBottom}
          className="pointer-events-auto absolute bottom-full left-1/2 z-20 mb-2 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs text-gray-600 shadow-sm transition-colors hover:bg-black/[0.03]"
        >
          <ArrowDown className="h-3.5 w-3.5" />
          回到底部
        </button>
      ) : null}
      {isLoading ? (
        <div
          className="text-base mx-auto [--thread-content-margin:--spacing(4)] @w-sm/main:[--thread-content-margin:--spacing(6)] @w-lg/main:[--thread-content-margin:--spacing(16)] px-(--thread-content-margin)"
          style={{ backgroundColor: "var(--workspace-bg)" }}
        >
          <div
            className="[--thread-content-max-width:40rem] @w-lg/main:[--thread-content-max-width:48rem] mx-auto max-w-(--thread-content-max-width) flex-1 mb-4"
            style={{ maxWidth: "48rem", width: "100%" }}
          >
            <div
              className="bg-token-bg-primary corner-superellipse/1.1 overflow-clip bg-clip-padding p-2.5 contain-inline-size shadow-short"
              style={{ borderRadius: "28px" }}
            >
              <div className="-my-2.5 flex min-h-14 items-center px-1.5">
                <div className="h-4 w-40 animate-pulse rounded bg-black/[0.06]" />
              </div>
            </div>
          </div>
        </div>
      ) : (
        <ChatInput
          onSend={(message, images) => {
            void send(message, images);
          }}
          isStreaming={isStreaming}
          onInterrupt={stop}
          streamingSendable
          showVoiceControls={false}
          showContinueAction={false}
          placeholder="说说你想要一个什么样的角色，或继续补充要求…"
          onRegisterSetText={(fn) => {
            setComposerTextRef.current = fn;
          }}
        />
      )}
      {error ? (
        <div className="mx-auto -mt-2 mb-4 w-full max-w-[48rem] px-4 @w-sm/main:px-6 @w-lg/main:px-16">
          <div className="flex items-center justify-between rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
            <span>{error}</span>
            <button
              type="button"
              onClick={clearError}
              className="ml-3 shrink-0 underline"
            >
              知道了
            </button>
          </div>
        </div>
      ) : null}
    </>
  );

  return (
    <>
      <ChatMainFrame
        header={header}
        thread={thread}
        composer={composer}
        scrollRootRef={scrollRootRef}
      />

      <ChatHistorySidebar
        isOpen={isHistoryOpen}
        character={null}
        rows={historyRows}
        loading={isLoading}
        activeChatId={activeSessionId ?? ""}
        activeChatTitle=""
        onClose={() => setHistoryOpen(false)}
        onSelectChat={(sessionId) => {
          void openSession(sessionId);
          setHistoryOpen(false);
        }}
        onRenameChat={async (sessionId, title) => {
          await renameSession(sessionId, title);
        }}
        onDeleteChat={async (sessionId) => {
          await removeSession(sessionId);
        }}
      />

      <CharacterChatDialog
        open={Boolean(chatDialog)}
        onOpenChange={(open) => !open && setChatDialog(null)}
        chatId={chatDialog?.chatId ?? null}
        characterName={chatDialog?.name ?? ""}
        characterAvatar={chatDialog?.avatar}
      />

      {lightbox ? (
        <ImageLightbox
          images={lightbox.images.map((img) => ({
            src: img.original,
            previewSrc: img.display,
          }))}
          initialIndex={lightbox.index}
          open
          onClose={() => setLightbox(null)}
        />
      ) : null}
    </>
  );
}
