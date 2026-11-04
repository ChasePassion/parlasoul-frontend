"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { LoaderCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth-context";
import { listChats } from "@/lib/api";
import { consumeShareCard } from "@/lib/growth-api";
import { useGrowth } from "@/lib/growth-context";
import { queryKeys } from "@/lib/query";
import {
  getShareCardAssetUrls,
  preloadShareCardAssets,
} from "@/lib/share-card-assets";
import ShareCardRenderer from "./ShareCardRenderer";

function setDownloadStage(stage: string, detail?: string) {
  if (typeof window === "undefined") {
    return;
  }

  (
    window as Window & {
      __shareCardDownloadStage?: string;
      __shareCardDownloadDetail?: string;
      __shareCardDownloadError?: string;
    }
  ).__shareCardDownloadStage = stage;

  (
    window as Window & {
      __shareCardDownloadDetail?: string;
    }
  ).__shareCardDownloadDetail = detail ?? "";
}

function applyExportFooter(root: HTMLElement): (() => void) | null {
  const footerButton = root.querySelector<HTMLElement>("[data-download-footer='true']");
  if (!footerButton) {
    return null;
  }

  const previousHtml = footerButton.innerHTML;
  const previousGap = footerButton.style.gap;

  footerButton.innerHTML = '<span aria-hidden="true" style="font-size:14px;line-height:1">→</span><span>parlasoul.com</span>';
  footerButton.style.gap = "5px";

  return () => {
    footerButton.innerHTML = previousHtml;
    footerButton.style.gap = previousGap;
  };
}

async function waitForRenderedShareCardAssets(root: HTMLElement): Promise<void> {
  if (typeof document !== "undefined" && "fonts" in document) {
    await document.fonts.ready;
  }

  const images = Array.from(root.querySelectorAll("img"));

  await Promise.all(
    images.map(
      (image) =>
        new Promise<void>((resolve) => {
          const finish = () => {
            image.removeEventListener("load", finish);
            image.removeEventListener("error", finish);
            resolve();
          };

          if (image.complete) {
            const decodePromise = image.decode
              ? image.decode()
              : Promise.resolve();
            void decodePromise.catch(() => undefined).finally(resolve);
            return;
          }

          image.addEventListener("load", finish, { once: true });
          image.addEventListener("error", finish, { once: true });
        }),
    ),
  );

  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

async function downloadBlobAsPng(
  blob: Blob,
  filename: string,
): Promise<void> {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function ShareCardDialog() {
  const { user } = useAuth();
  const { pendingShareCards, dismissShareCard } = useGrowth();
  const [isDownloading, setIsDownloading] = useState(false);
  const [readyAssetKey, setReadyAssetKey] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const currentCard =
    pendingShareCards.length > 0 ? pendingShareCards[0] : null;
  const milestonePayload =
    currentCard?.kind === "character_message_milestone"
      ? currentCard.character_milestone_payload
      : null;
  const milestoneCharacterId = milestonePayload?.character_id ?? null;
  const firstChatDateQuery = useQuery({
    queryKey: [
      ...queryKeys.chats.history(user?.id, milestoneCharacterId, 100),
      "first-chat-date",
    ] as const,
    queryFn: async ({ signal }) => {
      if (!milestoneCharacterId) {
        return null;
      }

      let cursor: string | undefined;
      let oldestCreatedAt: string | null = null;

      while (true) {
        const page = await listChats(
          {
            character_id: milestoneCharacterId,
            cursor,
            limit: 100,
          },
          { signal },
        );

        if (page.items.length > 0) {
          oldestCreatedAt =
            page.items[page.items.length - 1]?.chat.created_at ?? oldestCreatedAt;
        }

        if (!page.has_more || !page.next_cursor) {
          break;
        }

        cursor = page.next_cursor;
      }

      return oldestCreatedAt;
    },
    enabled: Boolean(user?.id && milestoneCharacterId),
    staleTime: 5 * 60 * 1000,
  });
  const milestoneFirstChatDate = firstChatDateQuery.data ?? null;
  const userAvatar = user?.avatar_urls?.md || "/default-avatar.svg";
  const assetKey = useMemo(
    () => (currentCard ? `${currentCard.id}:${currentCard.kind}` : null),
    [currentCard],
  );
  const assetUrls = useMemo(
    () =>
      currentCard ? getShareCardAssetUrls(currentCard, userAvatar) : [],
    [currentCard, userAvatar],
  );
  const isCardReady = !!assetKey && readyAssetKey === assetKey;

  useLayoutEffect(() => {
    setReadyAssetKey(null);
  }, [assetKey]);

  useEffect(() => {
    if (!currentCard || !assetKey) {
      setReadyAssetKey(null);
      return;
    }

    let cancelled = false;

    void preloadShareCardAssets(assetUrls)
      .catch((err) => {
        console.error("Failed to preload share card assets:", err);
      })
      .finally(() => {
        if (!cancelled) {
          setReadyAssetKey(assetKey);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [assetKey, assetUrls, currentCard]);

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
    if (!cardRef.current || isDownloading || !isCardReady) return;

    setIsDownloading(true);
    setDownloadStage("start");

    try {
      setDownloadStage("preload-assets");
      await preloadShareCardAssets(assetUrls);
      setDownloadStage("wait-render-before-export");
      await waitForRenderedShareCardAssets(cardRef.current);
      setDownloadStage("mutate-export-footer");
      const restoreFooter = applyExportFooter(cardRef.current);
      const { toBlob } = await import("html-to-image");
      let blob: Blob | null = null;

      try {
        setDownloadStage("wait-frame-1");
        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => resolve());
        });
        setDownloadStage("wait-frame-2");
        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => resolve());
        });
        setDownloadStage("wait-render-after-export");
        await waitForRenderedShareCardAssets(cardRef.current);
        setDownloadStage("toBlob");

        blob = await toBlob(cardRef.current, {
          cacheBust: false,
          pixelRatio: 2,
          skipAutoScale: true,
        });
        setDownloadStage("toBlob-done", blob ? "blob-ok" : "blob-null");
      } finally {
        setDownloadStage("restore-preview-footer");
        restoreFooter?.();
      }

      if (!blob) {
        throw new Error("Failed to render share card blob");
      }

      setDownloadStage("download-blob");
      await downloadBlobAsPng(
        blob,
        `parlasoul-${currentCard?.kind ?? "card"}-${Date.now()}.png`,
      );
      setDownloadStage("done");
    } catch (err) {
      (
        window as Window & {
          __shareCardDownloadError?: string;
        }
      ).__shareCardDownloadError = err instanceof Error ? err.message : String(err);
      setDownloadStage("error");
      console.error("Failed to capture share card:", err);
    } finally {
      setIsDownloading(false);
    }
  }, [assetUrls, currentCard?.kind, isCardReady, isDownloading]);

  if (!currentCard) return null;

  return (
    <Dialog
      open={true}
      onOpenChange={(open) => {
        if (!open) {
          void handleDismiss();
        }
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="w-auto max-w-none gap-0 overflow-visible border-0 bg-transparent p-0 shadow-none"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>分享卡片预览</DialogTitle>
          <DialogDescription>预览并下载成长分享卡片。</DialogDescription>
        </DialogHeader>

        <div className="flex justify-center">
          {isCardReady ? (
            <div ref={cardRef} className="shrink-0">
              <ShareCardRenderer
                card={currentCard}
                onDownload={() => void handleDownload()}
                milestoneFirstChatDate={milestoneFirstChatDate}
              />
            </div>
          ) : (
            <div className="flex min-h-32 min-w-32 items-center justify-center">
              <div className="flex flex-col items-center justify-center gap-4 text-white">
                <LoaderCircle className="size-9 animate-spin text-white/82" />
                <p className="text-sm tracking-[0.1em] text-white/68">
                  图片资源加载中...
                </p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
