"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
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
import { getErrorMessage } from "@/lib/error-map";
import { listChats, type ChatHistoryItem, type ChatResponse } from "@/lib/api";

interface ChatHistorySidebarProps {
  isOpen: boolean;
  character: Character | null;
  activeChatId: string;
  activeChatTitle: string;
  refreshKey: number;
  onClose: () => void;
  onSelectChat: (chatId: string) => void;
  onRenameChat: (chatId: string, title: string) => Promise<ChatResponse>;
  onDeleteChat: (chatId: string) => Promise<void>;
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

export default function ChatHistorySidebar({
  isOpen,
  character,
  activeChatId,
  activeChatTitle,
  refreshKey,
  onClose,
  onSelectChat,
  onRenameChat,
  onDeleteChat,
}: ChatHistorySidebarProps) {
  const [items, setItems] = useState<ChatHistoryItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [renamingChatId, setRenamingChatId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renameError, setRenameError] = useState<string | null>(null);
  const [isSavingRename, setIsSavingRename] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<ChatHistoryItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadPage = useCallback(
    async (cursor?: string, append = false) => {
      if (!character) return;

      if (append) {
        setIsLoadingMore(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      try {
        const page = await listChats({
          character_id: character.id,
          cursor,
          limit: PAGE_SIZE,
        });

        setItems((prev) => (append ? [...prev, ...page.items] : page.items));
        setNextCursor(page.next_cursor ?? null);
        setHasMore(page.has_more);
      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        if (append) {
          setIsLoadingMore(false);
        } else {
          setIsLoading(false);
        }
      }
    },
    [character],
  );

  useEffect(() => {
    if (!isOpen || !character) return;
    void loadPage();
  }, [character, isOpen, loadPage, refreshKey]);

  useEffect(() => {
    if (!isOpen) {
      setRenamingChatId(null);
      setRenameValue("");
      setRenameError(null);
      setDeleteTarget(null);
    }
  }, [isOpen]);

  const displayItems = useMemo(
    () =>
      items.map((item) =>
        item.chat.id === activeChatId
          ? {
              ...item,
              chat: {
                ...item.chat,
                title: activeChatTitle || item.chat.title,
              },
            }
          : item,
      ),
    [activeChatId, activeChatTitle, items],
  );

  const beginRename = useCallback((item: ChatHistoryItem) => {
    setRenamingChatId(item.chat.id);
    setRenameValue(item.chat.title ?? "");
    setRenameError(null);
  }, []);

  const cancelRename = useCallback(() => {
    setRenamingChatId(null);
    setRenameValue("");
    setRenameError(null);
  }, []);

  const submitRename = useCallback(
    async (chatId: string) => {
      const trimmedTitle = renameValue.trim();
      if (!trimmedTitle) {
        setRenameError("标题不能为空");
        return;
      }

      setIsSavingRename(true);
      setRenameError(null);
      try {
        const updated = await onRenameChat(chatId, trimmedTitle);
        setItems((prev) =>
          prev.map((item) =>
            item.chat.id === chatId
              ? {
                  ...item,
                  chat: updated,
                }
              : item,
          ),
        );
        cancelRename();
      } catch (err) {
        setRenameError(getErrorMessage(err));
      } finally {
        setIsSavingRename(false);
      }
    },
    [cancelRename, onRenameChat, renameValue],
  );

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;

    setIsDeleting(true);
    setError(null);
    try {
      await onDeleteChat(deleteTarget.chat.id);
      setItems((prev) => prev.filter((item) => item.chat.id !== deleteTarget.chat.id));
      if (renamingChatId === deleteTarget.chat.id) {
        cancelRename();
      }
      setDeleteTarget(null);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsDeleting(false);
    }
  }, [cancelRename, deleteTarget, onDeleteChat, renamingChatId]);

  return (
    <>
      <div
        className={`absolute inset-0 z-30 transition ${
          isOpen ? "pointer-events-auto bg-black/20" : "pointer-events-none bg-transparent"
        }`}
        onClick={onClose}
      />

      <aside
        className={`absolute inset-y-0 right-0 z-40 flex w-full max-w-[360px] flex-col border-l border-divider bg-white shadow-[-12px_0_40px_rgba(15,23,42,0.12)] transition-transform duration-200 ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-divider px-5 py-4">
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-text-primary">历史记录</h3>
            <p className="truncate text-sm text-gray-500">
              {character ? character.name : "当前角色"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-sm text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
          >
            关闭
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3">
          {isLoading ? (
            <div className="px-2 py-8 text-center text-sm text-gray-500">加载中...</div>
          ) : null}

          {!isLoading && error ? (
            <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-3 text-sm text-red-600">
              {error}
            </div>
          ) : null}

          {!isLoading && !error && displayItems.length === 0 ? (
            <div className="px-2 py-8 text-center text-sm text-gray-500">
              还没有历史记录
            </div>
          ) : null}

          <div className="flex flex-col gap-2">
            {displayItems.map((item) => {
              const isActive = item.chat.id === activeChatId;
              const isRenaming = renamingChatId === item.chat.id;

              return (
                <div
                  key={item.chat.id}
                  className={`group rounded-2xl border px-3 py-3 transition-colors ${
                    isActive
                      ? "border-[#3964FE]/20 bg-[#3964FE]/6"
                      : "border-transparent bg-gray-50 hover:border-gray-200 hover:bg-white"
                  }`}
                >
                  {isRenaming ? (
                    <div className="flex flex-col gap-2">
                      <Input
                        value={renameValue}
                        onChange={(event) => {
                          setRenameValue(event.target.value);
                          if (renameError) setRenameError(null);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            void submitRename(item.chat.id);
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
                      {renameError ? (
                        <p className="text-xs text-red-600">{renameError}</p>
                      ) : null}
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
                          onClick={() => void submitRename(item.chat.id)}
                          disabled={isSavingRename}
                        >
                          {isSavingRename ? "保存中..." : "保存"}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3">
                      <button
                        type="button"
                        onClick={() => onSelectChat(item.chat.id)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <div className="truncate text-sm font-medium text-gray-900">
                          {getChatTitle(item.chat.title)}
                        </div>
                        <div className="mt-1 text-xs text-gray-500">
                          {formatTimestamp(item.chat.last_turn_at ?? item.chat.created_at)}
                        </div>
                      </button>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className="opacity-0 transition-opacity group-hover:opacity-100 rounded-lg p-1.5 hover:bg-gray-100 data-[state=open]:opacity-100"
                            aria-label="更多操作"
                          >
                            <Image
                              src="/vertical dots.svg"
                              alt=""
                              width={16}
                              height={16}
                            />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" sideOffset={8} className="w-40">
                          <DropdownMenuItem onClick={() => beginRename(item)}>
                            <Image
                              src="/icons/edit-6d87e1.svg"
                              alt=""
                              width={16}
                              height={16}
                            />
                            重命名
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => setDeleteTarget(item)}
                          >
                            <Image src="/delete.svg" alt="" width={16} height={16} />
                            删除
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {hasMore ? (
            <div className="pt-3">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => void loadPage(nextCursor ?? undefined, true)}
                disabled={isLoadingMore}
              >
                {isLoadingMore ? "加载中..." : "加载更多"}
              </Button>
            </div>
          ) : null}
        </div>
      </aside>

      <DeleteConfirmDialog
        isOpen={!!deleteTarget}
        entityLabel="聊天"
        entityName={getChatTitle(deleteTarget?.chat.title)}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleteTarget(null)}
        isDeleting={isDeleting}
      />
    </>
  );
}
