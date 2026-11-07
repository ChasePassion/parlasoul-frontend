"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { getCharacterById } from "@/lib/api";
import type { AvatarUrls } from "@/lib/api-service";
import { resolveCharacterAvatarSrc } from "@/lib/character-avatar";
import { useAuth } from "@/lib/auth-context";
import { parseUuidFromSlug } from "@/lib/share-link";
import { queryKeys } from "@/lib/query/query-keys";
import { useOpenCharacterChat } from "@/hooks/useOpenCharacterChat";
import { LoadingStatus, RouteSkeleton } from "@/components/LoadingStates";

function SharePageFallback() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <header className="px-10 py-7 flex items-center gap-2.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/icon.svg"
          alt="ParlaSoul"
          className="size-7 rounded-lg"
          width={28}
          height={28}
        />
        <span className="text-lg font-bold tracking-tight">ParlaSoul</span>
      </header>
      <main className="flex-1 flex items-center justify-center px-6 pb-16">
        <RouteSkeleton className="max-w-sm" lines={2} />
      </main>
    </div>
  );
}

interface ShareCharacterView {
  id: string;
  name: string;
  description: string;
  avatarSrc: string;
  avatar_image_key?: string | null;
  avatar_urls?: AvatarUrls | null;
}

type SharePhase =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; character: ShareCharacterView };

function SharePageContent() {
  const params = useParams<{ slug: string }>();
  const { user, isInitialLoading: isAuthLoading } = useAuth();
  const { open } = useOpenCharacterChat();

  const slug = params.slug;
  const uuid = useMemo(() => parseUuidFromSlug(slug), [slug]);
  const [phase, setPhase] = useState<SharePhase>({ kind: "loading" });

  const characterQuery = useQuery({
    queryKey: queryKeys.characters.detail(null, uuid),
    queryFn: ({ signal }) => getCharacterById(uuid!, { signal }),
    enabled: !!uuid,
  });

  const handleError = useCallback((message: string) => {
    setPhase({ kind: "error", message });
  }, []);

  // 角色信息到达 -> 立即展示真实内容，不再等假动画
  useEffect(() => {
    if (!uuid) {
      handleError("无法加载角色信息");
      return;
    }
    if (characterQuery.isLoading) return;
    if (characterQuery.isError || !characterQuery.data) {
      handleError("无法加载角色信息");
      return;
    }

    const character = characterQuery.data;
    const avatarSrc = resolveCharacterAvatarSrc(
      {
        name: character.name,
        avatar_urls: character.avatar_urls,
        avatar_image_key: character.avatar_image_key,
      },
      "xl",
    );

    setPhase({
      kind: "ready",
      character: {
        id: character.id,
        name: character.name,
        description: character.description,
        avatarSrc,
        avatar_image_key: character.avatar_image_key ?? null,
        avatar_urls: character.avatar_urls ?? null,
      },
    });
  }, [uuid, characterQuery.isLoading, characterQuery.isError, characterQuery.data, handleError]);

  // 立即乐观导航：访客由统一入口引导登录，已登录直接跳 /chat/new
  useEffect(() => {
    if (phase.kind !== "ready" || isAuthLoading) return;
    open(phase.character, { nextPath: `/share/${encodeURIComponent(slug)}` });
  }, [phase, isAuthLoading, open, slug, user]);

  const character = phase.kind === "ready" ? phase.character : null;

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <header className="px-10 py-7 flex items-center gap-2.5 max-sm:px-6 max-sm:py-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/icon.svg"
          alt="ParlaSoul"
          className="size-7 rounded-lg"
          width={28}
          height={28}
        />
        <span className="text-lg font-bold tracking-tight">ParlaSoul</span>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 pb-16 max-sm:px-5 max-sm:pb-12">
        {phase.kind === "loading" && <RouteSkeleton className="max-w-sm" lines={2} />}

        {phase.kind === "error" && (
          <LoadingStatus
            message={phase.message}
            onRetry={() => window.location.reload()}
          />
        )}

        {character && (
          <div className="flex flex-col items-center gap-8 w-full max-w-sm">
            <div className="flex flex-col items-center gap-4">
              <div className="relative size-28 rounded-full overflow-hidden">
                <Image
                  src={character.avatarSrc}
                  alt={character.name}
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>
              <h2 className="text-xl font-bold text-gray-900">{character.name}</h2>
            </div>
            <LoadingStatus message="正在进入对话…" pending />
          </div>
        )}
      </main>
    </div>
  );
}

export default function SharePage() {
  return (
    <Suspense fallback={<SharePageFallback />}>
      <SharePageContent />
    </Suspense>
  );
}
