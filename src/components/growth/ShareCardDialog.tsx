"use client";

import { useCallback, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useGrowth } from "@/lib/growth-context";
import { consumeShareCard } from "@/lib/growth-api";
import ShareCardRenderer from "./ShareCardRenderer";
import { Download, X } from "lucide-react";

export default function ShareCardDialog() {
  const { pendingShareCards, dismissShareCard } = useGrowth();
  const [isDownloading, setIsDownloading] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const currentCard =
    pendingShareCards.length > 0 ? pendingShareCards[0] : null;

  const handleDismiss = useCallback(async () => {
    if (!currentCard) return;
    try {
      await consumeShareCard(currentCard.id);
    } catch (err) {
      console.error("Failed to consume share card:", err);
    }
    dismissShareCard(currentCard.id);
  }, [currentCard, dismissShareCard]);

  const handleDownload = useCallback(async () => {
    if (!cardRef.current || isDownloading) return;
    setIsDownloading(true);

    try {
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(cardRef.current, {
        scale: 2,
        backgroundColor: null,
        useCORS: true,
      });

      const link = document.createElement("a");
      link.download = `neurachar-${currentCard?.kind ?? "card"}-${Date.now()}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (err) {
      console.error("Failed to capture share card:", err);
    } finally {
      setIsDownloading(false);
    }
  }, [currentCard?.kind, isDownloading]);

  if (!currentCard) return null;

  return (
    <Dialog
      open={true}
      onOpenChange={(open) => {
        if (!open) void handleDismiss();
      }}
    >
      <DialogContent className="max-w-[360px] rounded-2xl border-0 p-0 overflow-hidden shadow-2xl [&>button]:hidden">
        {/* Card content for screenshotting */}
        <div ref={cardRef}>
          <ShareCardRenderer card={currentCard} />
        </div>

        {/* Action buttons */}
        <div className="flex items-center justify-center gap-3 px-6 pb-5 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleDismiss()}
            className="flex-1 rounded-xl"
          >
            <X className="mr-1.5 h-4 w-4" />
            关闭
          </Button>
          <Button
            size="sm"
            onClick={() => void handleDownload()}
            disabled={isDownloading}
            className="flex-1 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white hover:from-blue-600 hover:to-indigo-700"
          >
            <Download className="mr-1.5 h-4 w-4" />
            {isDownloading ? "保存中..." : currentCard.primary_button_label}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
