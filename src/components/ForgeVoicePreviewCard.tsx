"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Pause, Play } from "lucide-react";

import type { ForgeVoicePreviewPayload } from "@/lib/api";
import { getForgeVoicePreviewAudio } from "@/lib/api";

interface ForgeVoicePreviewCardProps {
  payload: ForgeVoicePreviewPayload;
}

export default function ForgeVoicePreviewCard({
  payload,
}: ForgeVoicePreviewCardProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, []);

  const handlePlay = async () => {
    if (isPlaying) {
      audioRef.current?.pause();
      setIsPlaying(false);
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      const buffer = await getForgeVoicePreviewAudio(payload.preview_url);
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
      const blob = new Blob([buffer], { type: "audio/mpeg" });
      const url = URL.createObjectURL(blob);
      objectUrlRef.current = url;
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => setIsPlaying(false);
      audio.onerror = () => {
        setIsPlaying(false);
        setError("播放失败，请重试");
      };
      await audio.play();
      setIsPlaying(true);
    } catch {
      setError("试听生成失败，请重试");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mt-2 w-full max-w-[420px] rounded-xl border border-[#3964FE]/20 bg-white p-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handlePlay}
          disabled={isLoading}
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#3964FE] text-white transition-all hover:opacity-90 active:scale-95 disabled:opacity-60 ${
            isPlaying ? "ring-4 ring-[#3964FE]/15" : ""
          }`}
          aria-label={isPlaying ? "暂停试听" : "播放试听"}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isPlaying ? (
            <Pause className="h-3.5 w-3.5 fill-current" />
          ) : (
            <Play className="h-3.5 w-3.5 translate-x-[1px] fill-current" />
          )}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold text-text-primary">
              {payload.display_name}
            </span>
            {isPlaying ? (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#3964FE]/10 px-1.5 py-0.5 text-[11px] font-medium text-[#3964FE]">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#3964FE]" />
                试听中
              </span>
            ) : null}
          </div>
          {payload.usage_hint ? (
            <div className="mt-0.5 truncate text-xs text-text-tertiary">
              {payload.usage_hint}
            </div>
          ) : null}
        </div>
      </div>

      <p
        className="mt-2.5 rounded-lg bg-black/[0.03] px-3 py-2 text-[13px] leading-6 text-text-secondary"
        style={{ textIndent: "-0.35em", paddingLeft: "calc(0.75rem + 0.35em)" }}
      >
        「{payload.sample_text}」
      </p>

      {error ? (
        <p className="mt-1.5 text-xs text-red-500">{error}</p>
      ) : null}
    </div>
  );
}
