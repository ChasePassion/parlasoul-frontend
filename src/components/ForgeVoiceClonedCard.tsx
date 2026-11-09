"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Pause, Play } from "lucide-react";

import type { ForgeVoiceClonedPayload } from "@/lib/api";
import { getForgeVoicePreviewAudio } from "@/lib/api";

/** Static silhouette shown while the clip is not playing. */
const BAR_BASE = [5, 9, 14, 8, 12, 17, 10, 13, 6, 11, 15, 7];
const BAR_HEIGHT = 18;

export default function ForgeVoiceClonedCard({
  payload,
}: {
  payload: ForgeVoiceClonedPayload;
}) {
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
      const url = URL.createObjectURL(new Blob([buffer], { type: "audio/mpeg" }));
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
    <div className="mt-2 flex w-full max-w-[420px] flex-col rounded-xl border border-[#3964FE]/20 bg-white p-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <style>{`
        @keyframes forge-clone-wave {
          0%, 100% { transform: scaleY(0.3); }
          50% { transform: scaleY(1); }
        }
        .forge-clone-wave-bar {
          height: ${BAR_HEIGHT}px;
          width: 2px;
          border-radius: 1px;
          transform-origin: center;
          transition: transform 220ms ease;
        }
        .forge-clone-wave-bar[data-playing="true"] {
          animation: forge-clone-wave 720ms ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .forge-clone-wave-bar[data-playing="true"] { animation: none; }
        }
      `}</style>

      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={handlePlay}
          disabled={isLoading}
          aria-label={isPlaying ? "暂停试听" : "播放试听"}
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#3964FE] text-white transition-all hover:opacity-90 active:scale-95 disabled:opacity-60 ${
            isPlaying ? "ring-4 ring-[#3964FE]/15" : ""
          }`}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isPlaying ? (
            <Pause className="h-3 w-3 fill-current" />
          ) : (
            <Play className="h-3 w-3 translate-x-[1px] fill-current" />
          )}
        </button>

        <span
          aria-hidden="true"
          className={`flex items-center gap-[2px] ${
            isPlaying ? "[&>span]:bg-[#3964FE]" : "[&>span]:bg-[#3964FE]/45"
          }`}
        >
          {BAR_BASE.map((height, index) => (
            <span
              key={index}
              className="forge-clone-wave-bar transition-[background-color] duration-200"
              data-playing={isPlaying ? "true" : "false"}
              style={{
                transform: `scaleY(${height / BAR_HEIGHT})`,
                animationDelay: `${index * 65}ms`,
                animationDuration: `${640 + (index % 4) * 90}ms`,
              }}
            />
          ))}
        </span>

        <span className="flex min-w-0 flex-col">
          <span className="truncate text-[13px] text-text-primary">
            {payload.display_name}
          </span>
          <span className="text-[11px] tabular-nums text-text-tertiary">
            {payload.duration_seconds.toFixed(1)} 秒
          </span>
        </span>
      </div>

      <p className="mt-2.5 rounded-lg bg-black/[0.03] px-3 py-2 text-[13px] leading-6 text-text-secondary">
        「{payload.sample_text}」
      </p>

      {error ? <p className="mt-1.5 text-xs text-red-500">{error}</p> : null}
    </div>
  );
}
