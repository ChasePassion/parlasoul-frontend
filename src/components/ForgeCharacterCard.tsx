"use client";

import { ArrowRight, ImagePlus, MessageCircle, Mic, Upload } from "lucide-react";

import type { ForgeCharacterPayload } from "@/lib/api";
import { resolveCharacterAvatarSrc } from "@/lib/character-avatar";

interface ForgeCharacterCardProps {
  payload: ForgeCharacterPayload;
  fallbackChatId?: string | null;
  onStartChat: (chatId: string) => void;
  onOpenChat: (payload: ForgeCharacterPayload) => void;
  onPublish: () => void;
  isPublishing: boolean;
  onRequestAvatar: () => void;
  isRequestingAvatar: boolean;
}

export default function ForgeCharacterCard({
  payload,
  fallbackChatId,
  onStartChat,
  onOpenChat,
  onPublish,
  isPublishing,
  onRequestAvatar,
  isRequestingAvatar,
}: ForgeCharacterCardProps) {
  const avatar = resolveCharacterAvatarSrc(
    { name: payload.name, avatar_image_key: payload.avatar_image_key ?? null },
    "md",
  );
  const chatId = payload.chat_id ?? fallbackChatId ?? null;
  const isPrivate = payload.visibility === "PRIVATE";

  return (
    <div className="mt-2 w-full max-w-[420px] rounded-xl border border-[#3964FE]/20 bg-white p-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <div className="flex items-start gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={avatar}
          alt={payload.name}
          className="h-12 w-12 shrink-0 rounded-lg object-cover"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-[15px] text-text-primary">
              {payload.name}
            </span>
            {isPrivate ? (
              <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700">
                未上架
              </span>
            ) : (
              <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700">
                已上架
              </span>
            )}
          </div>
          <div className="mt-0.5 line-clamp-2 text-xs leading-5 text-text-secondary">
            {payload.description}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-text-tertiary">
            <span className="inline-flex items-center gap-1 rounded-full bg-black/[0.04] px-2 py-0.5">
              <Mic className="h-3 w-3" />
              {payload.voice.display_name}
              {payload.voice.usage_hint ? ` · ${payload.voice.usage_hint}` : ""}
            </span>
            {payload.voice.speech_rate ? (
              <span>语速 {payload.voice.speech_rate.toFixed(2)}</span>
            ) : null}
          </div>
        </div>
      </div>

      {chatId ? (
        <div className="mt-3 flex items-stretch gap-2">
          <button
            type="button"
            onClick={() => onOpenChat(payload)}
            className="composer-submit-button-color flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm text-white transition-opacity hover:opacity-90"
          >
            <MessageCircle className="h-4 w-4" />
            和 TA 对话
          </button>
          <button
            type="button"
            onClick={() => onStartChat(chatId)}
            className="flex shrink-0 items-center justify-center gap-1 rounded-lg border border-divider bg-white px-3 py-2 text-sm text-text-primary transition-colors hover:bg-sidebar-hover"
          >
            打开聊天页
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <p className="mt-3 rounded-lg bg-black/[0.03] px-3 py-2 text-xs text-text-tertiary">
          角色已更新，回到聊天即可听到新声音。
        </p>
      )}

      {!payload.avatar_image_key ? (
        <button
          type="button"
          onClick={onRequestAvatar}
          disabled={isRequestingAvatar}
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-divider bg-white px-3 py-2 text-sm text-text-primary transition-colors hover:bg-sidebar-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ImagePlus className="h-3.5 w-3.5" />
          {isRequestingAvatar ? "处理中…" : "生成头像"}
        </button>
      ) : null}

      {isPrivate ? (
        <button
          type="button"
          onClick={onPublish}
          disabled={isPublishing}
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Upload className="h-3.5 w-3.5" />
          {isPublishing ? "上架中…" : "上架到角色市场"}
        </button>
      ) : null}
    </div>
  );
}
