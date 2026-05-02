"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { getCharacterById } from "@/lib/api";
import { resolveCharacterAvatarSrc } from "@/lib/character-avatar";
import { useAuth } from "@/lib/auth-context";
import { useGetOrCreateChatMutation } from "@/lib/query";
import { parseUuidFromSlug } from "@/lib/share-link";
import { queryKeys } from "@/lib/query/query-keys";
import { Progress } from "@/components/ui/progress";

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
        <div className="size-8 animate-spin rounded-full border-2 border-gray-200 border-t-black" />
      </main>
    </div>
  );
}

type SharePhase =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | {
      kind: "ready";
      character: {
        id: string;
        name: string;
        description: string;
        avatarSrc: string;
      };
    }
  | { kind: "progressing"; character: { id: string; name: string; description: string; avatarSrc: string } }
  | { kind: "redirecting"; character: { id: string; name: string; description: string; avatarSrc: string } };

function SharePageContent() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const { user, isInitialLoading: isAuthLoading } = useAuth();

  const slug = params.slug;
  const uuid = useMemo(() => parseUuidFromSlug(slug), [slug]);

  const [phase, setPhase] = useState<SharePhase>({ kind: "loading" });
  const [progress, setProgress] = useState(0);

  const { mutate: getOrCreateChat } = useGetOrCreateChatMutation(user?.id ?? null);

  const characterQuery = useQuery({
    queryKey: queryKeys.characters.detail(null, uuid),
    queryFn: ({ signal }) => getCharacterById(uuid!, { signal }),
    enabled: !!uuid,
  });

  const handleError = useCallback((message: string) => {
    setPhase({ kind: "error", message });
  }, []);

  // Phase: character data loaded → decide next step
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

    setProgress(0);
    setPhase({
      kind: "ready",
      character: {
        id: character.id,
        name: character.name,
        description: character.description,
        avatarSrc,
      },
    });
  }, [uuid, characterQuery.isLoading, characterQuery.isError, characterQuery.data, handleError]);

  // Phase: auth check → if not authed, redirect to login
  useEffect(() => {
    if (phase.kind !== "ready") return;
    if (isAuthLoading) return;

    if (!user) {
      router.replace(`/login?next=/share/${encodeURIComponent(slug)}`);
    }
  }, [phase.kind, isAuthLoading, user, slug, router]);

  // Phase: user authed + ready → start progressing
  useEffect(() => {
    if (phase.kind !== "ready") return;
    if (!user) return;

    setPhase({ kind: "progressing", character: phase.character });

    // Start progress bar animation on next frame
    const raf = requestAnimationFrame(() => {
      setProgress(100);
    });

    return () => cancelAnimationFrame(raf);
  }, [phase, user]);

  // Phase: progressing → create chat when progress completes
  useEffect(() => {
    if (phase.kind !== "progressing") return;
    if (progress < 100) return;

    const { character } = phase;

    const timer = setTimeout(() => {
      getOrCreateChat(character.id, {
        onSuccess: (chatId) => {
          setPhase({ kind: "redirecting", character });
          router.replace(`/chat/${chatId}`);
        },
        onError: () => {
          handleError("无法加载角色信息");
        },
      });
    }, 2000);

    return () => clearTimeout(timer);
  }, [phase, progress, getOrCreateChat, router, handleError]);

  // ── Render ──

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
        {phase.kind === "loading" && (
          <div className="size-8 animate-spin rounded-full border-2 border-gray-200 border-t-black" />
        )}

        {phase.kind === "error" && (
          <div className="text-center">
            <p className="text-gray-500 text-sm">{phase.message}</p>
          </div>
        )}

        {(phase.kind === "ready" ||
          phase.kind === "progressing" ||
          phase.kind === "redirecting") && (
          <div className="flex flex-col items-center gap-8 w-full max-w-sm">
            <div className="flex flex-col items-center gap-4">
              <div className="relative size-28 rounded-full overflow-hidden">
                <Image
                  src={phase.character.avatarSrc}
                  alt={phase.character.name}
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>
              <h2 className="text-xl font-bold text-gray-900">
                {phase.character.name}
              </h2>
            </div>

            <div className="w-full space-y-2">
              <Progress value={progress} duration={2000} className="h-2" />
            </div>
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
