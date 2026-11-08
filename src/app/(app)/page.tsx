"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useGrowth } from "@/lib/growth-context";
import { peekResumeCharacterId } from "@/lib/pending-chat";
import { readBrowserTourCompleted } from "@/lib/onboarding/tour-storage";
import { useOpenCharacterChat } from "@/hooks/useOpenCharacterChat";
import WorkspaceFrame from "@/components/layout/WorkspaceFrame";
import { useSidebar } from "./layout";
import TopConsole from "@/components/TopConsole";
import HeroCarousel from "@/components/HeroCarousel";
import HorizontalSection from "@/components/HorizontalSection";
import {
  selectHeroCharacters,
  filterCharactersByName,
} from "@/lib/discover-data";
import type { CharacterResponse } from "@/lib/api-service";
import type { Character } from "@/components/Sidebar";
import { resolveCharacterAvatarSrc } from "@/lib/character-avatar";
import {
  useAllMarketCharactersQuery,
  useDiscoverConfigQuery,
} from "@/lib/query";

export default function DiscoverPage() {
  const { user } = useAuth();
  const { refreshGrowthEntry } = useGrowth();
  const { toggleSidebar, setSelectedCharacterId } = useSidebar();
  const userId = user?.id ?? null;
  const discoverConfigQuery = useDiscoverConfigQuery();
  const marketCharactersQuery = useAllMarketCharactersQuery();
  const { open, prefetchOnIntent } = useOpenCharacterChat();

  const [searchQuery, setSearchQuery] = useState("");
  const discoverCharacters = useMemo(
    () => marketCharactersQuery.data ?? [],
    [marketCharactersQuery.data],
  );
  const heroItems = useMemo(
    () => discoverConfigQuery.data?.hero_items ?? [],
    [discoverConfigQuery.data],
  );
  const isLoading =
    discoverConfigQuery.isLoading || marketCharactersQuery.isLoading;

  useEffect(() => {
    if (!userId) {
      return;
    }

    // 导览还没走完、或这次登录由点击角色触发时，签到弹窗先让路：
    // 否则它会在导览中途弹出，把导览压掉，关掉后又重新拉起一次导览。
    const hasPendingResume = peekResumeCharacterId() !== null;
    const onboardingPending =
      !readBrowserTourCompleted() && user?.onboarding_status === "pending";
    const autoOpenPopup = !hasPendingResume && !onboardingPending;
    void refreshGrowthEntry({ autoOpenPopup }).catch((err) => {
      console.error("Failed to refresh growth entry:", err);
    });
  }, [refreshGrowthEntry, user, userId]);

  // 当处于 Discover 页时清除选中的角色
  useEffect(() => {
    setSelectedCharacterId(null);
  }, [setSelectedCharacterId]);

  // 计算 Search Results (最多取8个)
  const searchResults = useMemo(() => {
    return filterCharactersByName(discoverCharacters, searchQuery).slice(0, 8);
  }, [discoverCharacters, searchQuery]);

  // 计算 Hero 角色
  const heroCharacters = useMemo(() => {
    return selectHeroCharacters(discoverCharacters, heroItems);
  }, [discoverCharacters, heroItems]);

  // 全站统一入口：pending 态、防连点、意图预取、首帧种子、访客引导都在 hook 内。
  const handleSelectCharacter = (character: CharacterResponse | Character) => {
    void open(character);
  };

  // 角色续接统一在 (app)/layout.tsx 处理：登录页直接进聊天，布局层负责
  // 失败重试，避免发现页与布局层同时抢 id。

  // 转换全量数据以匹配 Character 接口 (用于 HorizontalSection 的 cards)
  const mappedCharacters = useMemo<Character[]>(() => {
    return discoverCharacters.map((character) => ({
      id: character.id,
      name: character.name,
      description: character.description,
      avatar: resolveCharacterAvatarSrc(character, "md"),
      avatar_image_key: character.avatar_image_key ?? null,
      avatar_urls: character.avatar_urls ?? null,
      system_prompt: character.system_prompt,
      greeting_message: character.greeting_message,
      visibility: character.visibility,
      creator_id: character.creator_id,
      creator_username: character.creator_username,
      voice_provider: character.voice_provider,
      voice_model: character.voice_model,
      voice_provider_voice_id: character.voice_provider_voice_id,
      voice_source_type: character.voice_source_type,
      voice: character.voice ?? undefined,
      llm_preset_id: character.llm_preset_id,
      distinct_user_count: character.distinct_user_count,
    }));
  }, [discoverCharacters]);

  // 按分类拆分角色
  const storyIds = useMemo(
    () => new Set(discoverConfigQuery.data?.story_character_ids ?? []),
    [discoverConfigQuery.data],
  );
  const professionalIds = useMemo(
    () => new Set(discoverConfigQuery.data?.professional_character_ids ?? []),
    [discoverConfigQuery.data],
  );
  const companionCharacters = useMemo(
    () => mappedCharacters.filter(c => !storyIds.has(c.id) && !professionalIds.has(c.id)),
    [mappedCharacters, storyIds, professionalIds],
  );
  const storyCharacters = useMemo(
    () => mappedCharacters.filter(c => storyIds.has(c.id)),
    [mappedCharacters, storyIds],
  );
  const professionalCharacters = useMemo(
    () => mappedCharacters.filter(c => professionalIds.has(c.id)),
    [mappedCharacters, professionalIds],
  );

  // 加载状态
  if (isLoading) {
    return (
      <WorkspaceFrame>
        <div className="flex h-full items-center justify-center bg-white">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      </WorkspaceFrame>
    );
  }

  return (
    <WorkspaceFrame
      header={
        <TopConsole
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          searchResults={searchResults}
          onSelectSearchResult={handleSelectCharacter}
          onToggleSidebar={toggleSidebar}
          onPrefetchCharacter={prefetchOnIntent}
        />
      }
    >
      <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar bg-white">
        <div className="max-w-[1400px] mx-auto px-4 md:px-10 pt-0 pb-6 min-h-full flex flex-col">

          {/* 主内容区 */}
          <div className="flex-1 pb-10">
            <div className="flex flex-col animate-in fade-in duration-500">
              {/* 巨幕轮播 */}
              <HeroCarousel
                characters={heroCharacters}
                onSelectCharacter={handleSelectCharacter}
                onPrefetchCharacter={prefetchOnIntent}
              />

              {/* 陪伴型角色横滑区 */}
              {companionCharacters.length > 0 && (
                <HorizontalSection
                  title="陪伴"
                  characters={companionCharacters}
                  onSelectCharacter={handleSelectCharacter}
                  tourId="discover-companion"
                  onPrefetchCharacter={prefetchOnIntent}
                />
              )}

              {/* 剧情向角色横滑区 */}
              {storyCharacters.length > 0 && (
                <HorizontalSection
                  title="剧情"
                  characters={storyCharacters}
                  onSelectCharacter={handleSelectCharacter}
                  tourId="discover-story"
                  onPrefetchCharacter={prefetchOnIntent}
                />
              )}

              {/* 职业向角色横滑区 */}
              {professionalCharacters.length > 0 && (
                <HorizontalSection
                  title="职业"
                  characters={professionalCharacters}
                  onSelectCharacter={handleSelectCharacter}
                  tourId="discover-professional"
                  onPrefetchCharacter={prefetchOnIntent}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </WorkspaceFrame>
  );
}
