"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { X, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import type { Character } from "@/components/Sidebar";
import DeleteConfirmDialog from "@/components/DeleteConfirmDialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getErrorMessage } from "@/lib/error-map";
import { useAuth } from "@/lib/auth-context";
import { useChatHistoryInfiniteQuery } from "@/lib/query";
import { toast } from "sonner";

interface ChatHistorySidebarProps {
  isOpen: boolean;
  character: Character | null;
  activeChatId: string;
  activeChatTitle: string;
  onClose: () => void;
  onSelectChat: (chatId: string) => void;
  onRenameChat: (chatId: string, title: string) => Promise<unknown>;
  onDeleteChat: (chatId: string) => Promise<void>;
  /** Supply rows from another source (e.g. character-forge sessions). When
   *  provided, the built-in chat-history query is skipped. */
  rows?: ChatHistoryRow[] | null;
  loading?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  loadingMore?: boolean;
  loadError?: unknown | null;
}

export interface ChatHistoryRow {
  id: string;
  title: string;
  timestamp?: string | null;
}

const PAGE_SIZE = 20;

function formatTimestamp(value?: string | null): string {
  if (!value) return "暂无消息";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "暂无消息";

  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getChatTitle(title?: string | null): string {
  const trimmedTitle = title?.trim();
  return trimmedTitle?.length ? trimmedTitle : "新聊天";
}

function ChatHistorySkeleton() {
  return (
    <div className="flex flex-col gap-3 px-2 py-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-start gap-3 rounded-2xl border border-transparent bg-gray-50 px-3 py-3">
          <div className="min-w-0 flex-1">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="mt-2 h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ChatHistorySidebar({
  isOpen,
  character,
  activeChatId,
  activeChatTitle,
  onClose,
  onSelectChat,
  onRenameChat,
  onDeleteChat,
  rows,
  loading,
  hasMore,
  onLoadMore,
  loadingMore,
  loadError,
}: ChatHistorySidebarProps) {
  const { user } = useAuth();
  const historyQuery = useChatHistoryInfiniteQuery(
    user?.id,
    character?.id,
    isOpen && !rows,
    PAGE_SIZE,
  );
  const queryRows = useMemo<ChatHistoryRow[]>(
    () =>
      historyQuery.data?.pages.flatMap((page) =>
        page.items.map((item) => ({
          id: item.chat.id,
          title: getChatTitle(item.chat.title),
          timestamp: item.chat.last_turn_at ?? item.chat.created_at ?? null,
        })),
      ) ?? [],
    [historyQuery.data],
  );
  const resolvedRows = rows ?? queryRows;
  const isLoading = loading ?? historyQuery.isLoading;
  const isLoadingMore = loadingMore ?? historyQuery.isFetchingNextPage;
  const isError = loadError != null ? true : historyQuery.isError;
  const errorValue = loadError ?? historyQuery.error;
  const hasNextPage = hasMore ?? historyQuery.hasNextPage ?? false;

  const [renamingChatId, setRenamingChatId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [isSavingRename, setIsSavingRename] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<ChatHistoryRow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setRenamingChatId(null);
      setRenameValue("");
      setDeleteTarget(null);
    }
  }, [isOpen]);

  const displayRows = useMemo(
    () =>
      resolvedRows.map((row) =>
        row.id === activeChatId
          ? { ...row, title: activeChatTitle || row.title }
          : row,
      ),
    [activeChatId, activeChatTitle, resolvedRows],
  );

  const beginRename = useCallback((row: ChatHistoryRow) => {
    setRenamingChatId(row.id);
    setRenameValue(row.title ?? "");
  }, []);

  const cancelRename = useCallback(() => {
    setRenamingChatId(null);
    setRenameValue("");
  }, []);

  const submitRename = useCallback(
    async (chatId: string) => {
      const trimmedTitle = renameValue.trim();
      if (!trimmedTitle) {
        toast.error("标题不能为空");
        return;
      }

      setIsSavingRename(true);
      try {
        await onRenameChat(chatId, trimmedTitle);
        cancelRename();
      } catch (err) {
        toast.error(getErrorMessage(err));
      } finally {
        setIsSavingRename(false);
      }
    },
    [cancelRename, onRenameChat, renameValue],
  );

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;

    setIsDeleting(true);
    try {
      await onDeleteChat(deleteTarget.id);
      if (renamingChatId === deleteTarget.id) {
        cancelRename();
      }
      setDeleteTarget(null);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsDeleting(false);
    }
  }, [cancelRename, deleteTarget, onDeleteChat, renamingChatId]);

  return (
    <>
      <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <SheetContent
          side="right"
          className="w-[85%] max-w-[320px] sm:w-[360px] p-0 gap-0 flex flex-col border-l border-border bg-background shadow-[-10px_0_20px_-10px_rgba(0,0,0,0.05)]"
          showCloseButton={false}
        >
          <SheetHeader className="flex flex-row items-center justify-between border-b border-border/60 px-5 h-[64px] space-y-0 shrink-0 transition-opacity">
            <div className="min-w-0">
              <SheetTitle className="text-base font-normal text-foreground tracking-tight">历史记录</SheetTitle>
            </div>
            <button
              onClick={onClose}
              className="h-8 w-8 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
              aria-label="关闭"
            >
              <X className="h-4 w-4 opacity-80" />
            </button>
          </SheetHeader>

          <ScrollArea className="flex-1 h-full px-3 py-3 overflow-hidden">
            {isLoading ? (
              <ChatHistorySkeleton />
            ) : null}

            {!isLoading && isError ? (
              <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-3 text-sm text-red-600">
                {getErrorMessage(errorValue)}
              </div>
            ) : null}

            {!isLoading && !isError && displayRows.length === 0 ? (
              <div className="px-2 py-8 text-center text-sm text-gray-500">
                还没有历史记录
              </div>
            ) : null}

            <div className="flex flex-col gap-1.5">
              {displayRows.map((row) => {
                const isActive = row.id === activeChatId;
                const isRenaming = renamingChatId === row.id;

                return (
                  <div
                    key={row.id}
                    className={`group relative chat-history-item rounded-xl px-3 py-2.5 flex items-center gap-2.5 transition-colors border-l-[2.5px] cursor-pointer ${
                      isActive
                        ? "bg-primary/[0.07] border-primary"
                        : "border-transparent hover:bg-accent/40"
                    }`}
                  >
                    {isRenaming ? (
                      <div className="flex flex-col gap-2 flex-1 w-full relative z-10">
                        <Input
                          value={renameValue}
                          onChange={(event) => {
                            setRenameValue(event.target.value);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              void submitRename(row.id);
                            }
                            if (event.key === "Escape") {
                              event.preventDefault();
                              cancelRename();
                            }
                          }}
                          autoFocus
                          maxLength={120}
                          placeholder="输入聊天标题"
                        />
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={cancelRename}
                            disabled={isSavingRename}
                          >
                            取消
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => void submitRename(row.id)}
                            disabled={isSavingRename}
                          >
                            {isSavingRename ? "保存中..." : "保存"}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => onSelectChat(row.id)}
                          className="min-w-0 flex-1 text-left flex flex-col justify-center"
                        >
                          <div className="min-w-0 history-title-fade text-[13.5px] font-normal text-foreground tracking-tight leading-tight">
                            {getChatTitle(row.title)}
                          </div>
                          <div className={`mt-0.5 flex items-center text-[11px] font-normal leading-tight ${isActive ? "text-muted-foreground" : "text-muted-foreground/80"}`}>
                            {formatTimestamp(row.timestamp)}
                          </div>
                        </button>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className="shrink-0 chat-history-menu-btn p-1 hover:bg-foreground/5 rounded-md text-muted-foreground hover:text-foreground flex items-center justify-center"
                              aria-label="更多操作"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" sideOffset={8} className="w-40">
                            <DropdownMenuItem onClick={() => beginRename(row)} className="cursor-pointer">
                              <Pencil className="mr-2 h-4 w-4" />
                              重命名
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              variant="destructive"
                              className="cursor-pointer"
                              onClick={() => setDeleteTarget(row)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              删除
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            {hasNextPage ? (
              <div className="pt-3 pb-2 px-1">
                <TooltipProvider delayDuration={300}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="w-full py-2 rounded-lg border border-border/80 text-[12px] font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
                        onClick={() => {
                          if (onLoadMore) void onLoadMore();
                          else void historyQuery.fetchNextPage();
                        }}
                        disabled={isLoadingMore}
                      >
                        {isLoadingMore ? "加载中..." : "加载更多"}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{isLoadingMore ? "正在加载更多聊天记录" : "点击加载更多历史记录"}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            ) : null}
          </ScrollArea>
        </SheetContent>
      </Sheet>

      <DeleteConfirmDialog
        isOpen={!!deleteTarget}
        entityLabel="聊天"
        entityName={getChatTitle(deleteTarget?.title)}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleteTarget(null)}
        isDeleting={isDeleting}
      />
    </>
  );
}
