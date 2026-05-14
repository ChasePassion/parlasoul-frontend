"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { X } from "lucide-react";

export interface LightboxImage {
  src: string;
  previewSrc?: string;
}

interface ImageLightboxProps {
  images: LightboxImage[];
  initialIndex?: number;
  open: boolean;
  onClose: () => void;
}

const SWIPE_THRESHOLD = 50;

export function ImageLightbox({ images, initialIndex = 0, open, onClose }: ImageLightboxProps) {
  const [current, setCurrent] = useState(initialIndex);
  const [displaySrc, setDisplaySrc] = useState("");
  const touchStartX = useRef(0);

  const prev = useCallback(() => {
    setCurrent((i) => (i - 1 + images.length) % images.length);
  }, [images.length]);

  const next = useCallback(() => {
    setCurrent((i) => (i + 1) % images.length);
  }, [images.length]);

  useEffect(() => {
    if (!open) return;
    setCurrent(initialIndex);
  }, [initialIndex, open]);

  useEffect(() => {
    if (!open || images.length === 0) return;

    const activeImage = images[current];
    if (!activeImage) return;

    const previewSrc = activeImage.previewSrc ?? activeImage.src;
    setDisplaySrc(previewSrc);

    if (!activeImage.previewSrc || activeImage.previewSrc === activeImage.src) {
      return;
    }

    let cancelled = false;
    const img = new Image();
    img.decoding = "async";
    img.src = activeImage.src;
    img.onload = () => {
      if (!cancelled) {
        setDisplaySrc(activeImage.src);
      }
    };
    return () => {
      cancelled = true;
    };
  }, [current, images, open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (images.length <= 1) {
        return;
      }
      if (e.key === "ArrowLeft") {
        prev();
      } else if (e.key === "ArrowRight") {
        next();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [images.length, next, onClose, open, prev]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > SWIPE_THRESHOLD) {
      if (diff > 0) next();
      else prev();
    }
  }, [prev, next]);

  if (images.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="bg-black/90 border-none shadow-none max-w-full max-h-full w-full h-full rounded-none flex items-center justify-center"
        showCloseButton={false}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        onClick={onClose}
      >
        <DialogTitle className="sr-only">
          图片查看 {current + 1} / {images.length}
        </DialogTitle>

        <button
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          className="absolute top-4 right-4 z-50 w-10 h-10 flex items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/40 transition-colors"
        >
          <X className="w-6 h-6" />
        </button>

        {images.length > 1 && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 text-white/70 text-sm z-50 pointer-events-none">
            {current + 1} / {images.length}
          </div>
        )}

        <img
          src={displaySrc || images[current]?.previewSrc || images[current]?.src}
          alt=""
          className="max-w-[90vw] max-h-[85vh] object-contain select-none"
          draggable={false}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onClick={(e) => e.stopPropagation()}
        />
      </DialogContent>
    </Dialog>
  );
}
