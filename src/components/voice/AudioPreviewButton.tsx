"use client";

import { useEffect, useId, useSyncExternalStore } from "react";
import { Play, Pause, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getVoicePreviewAudioStream } from "@/lib/api";
import { audioPreviewManager } from "@/lib/voice/audio-preview-manager";

interface AudioPreviewButtonProps {
  audioUrl: string | null;
  previewVoiceId?: string | null;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
}

export default function AudioPreviewButton({
  audioUrl,
  previewVoiceId = null,
  disabled = false,
  size = "md",
}: AudioPreviewButtonProps) {
  const buttonId = useId();
  const snapshot = useSyncExternalStore(
    audioPreviewManager.subscribe,
    audioPreviewManager.getSnapshot,
    audioPreviewManager.getSnapshot,
  );
  const isPlaying =
    snapshot.activeId === buttonId && snapshot.phase === "playing";
  const isLoading =
    snapshot.activeId === buttonId && snapshot.phase === "loading";

  useEffect(() => {
    return () => {
      audioPreviewManager.release(buttonId);
    };
  }, [buttonId]);

  const handlePlayPause = async () => {
    if (!audioUrl && !previewVoiceId) return;

    if (isPlaying) {
      audioPreviewManager.stop(buttonId);
      return;
    }

    try {
      if (audioUrl) {
        await audioPreviewManager.play(buttonId, {
          kind: "url",
          url: audioUrl,
        });
        return;
      }
      if (previewVoiceId) {
        await audioPreviewManager.play(buttonId, {
          kind: "blob",
          load: async () => {
            const audioBuffer = await getVoicePreviewAudioStream(previewVoiceId, {
              audio_format: "mp3",
            });
            return new Blob([audioBuffer], { type: "audio/mpeg" });
          },
        });
      }
    } catch {
      // The manager already resets shared playback state on failure.
    }
  };

  const sizeClasses = {
    sm: "h-7 w-7",
    md: "h-9 w-9",
    lg: "h-11 w-11",
  };

  const iconSizes = {
    sm: "w-3 h-3",
    md: "w-4 h-4",
    lg: "w-5 h-5",
  };

  if (!audioUrl && !previewVoiceId) {
    return (
      <Button
        variant="outline"
        size="icon"
        disabled
        className={`${sizeClasses[size]} rounded-full`}
      >
        <Play className={`${iconSizes[size]} opacity-50`} />
      </Button>
    );
  }

  return (
    <>
      <Button
        variant="outline"
        size="icon"
        onClick={handlePlayPause}
        disabled={disabled || isLoading}
        className={`${sizeClasses[size]} rounded-full`}
      >
        {isLoading ? (
          <Loader2 className={`${iconSizes[size]} animate-spin`} />
        ) : isPlaying ? (
          <Pause className={iconSizes[size]} />
        ) : (
          <Play className={iconSizes[size]} />
        )}
      </Button>
    </>
  );
}
