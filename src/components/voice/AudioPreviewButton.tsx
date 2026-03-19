"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Play, Pause, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AudioPreviewButtonProps {
  audioUrl: string | null;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
}

export default function AudioPreviewButton({
  audioUrl,
  disabled = false,
  size = "md",
}: AudioPreviewButtonProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
    };
  }, []);

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsPlaying(false);
  }, []);

  const handlePlayPause = async () => {
    if (!audioUrl) return;

    if (isPlaying) {
      stopAudio();
      return;
    }

    setIsLoading(true);
    try {
      if (audioRef.current) {
        audioRef.current.pause();
      }

      const response = await fetch(audioUrl);
      const blob = await response.blob();

      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
      objectUrlRef.current = URL.createObjectURL(blob);

      const audio = new Audio(objectUrlRef.current);
      audioRef.current = audio;

      audio.onended = () => {
        setIsPlaying(false);
      };

      audio.onerror = () => {
        setIsPlaying(false);
        setIsLoading(false);
      };

      await audio.play();
      setIsPlaying(true);
    } catch {
      setIsPlaying(false);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

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

  if (!audioUrl) {
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
