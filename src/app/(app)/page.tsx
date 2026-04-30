"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useGrowth } from "@/lib/growth-context";
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
  useGetOrCreateChatMutation,
} from "@/lib/query";

export default function DiscoverPage() {
  const { user } = useAuth();
  const { refreshGrowthEntry } = useGrowth();
  const router = useRouter();
  const { setSelectedCharacterId } = useSidebar();
  const userId = user?.id ?? null;
  const discoverConfigQuery = useDiscoverConfigQuery();
  const marketCharactersQuery = useAllMarketCharactersQuery();
  const openChatMutation = useGetOrCreateChatMutation(userId);

  const [searchQuery, setSearchQuery] = useState("");
  const discoverCharacters = useMemo(
    () => marketCharactersQuery.data ?? [],
    [marketCharactersQuery.data],
  );
  const heroCharacterIds = useMemo(
    () => discoverConfigQuery.data?.hero_character_ids ?? [],
    [discoverConfigQuery.data],
  );
  const isLoading =
    discoverConfigQuery.isLoading || marketCharactersQuery.isLoading;

  useEffect(() => {
    if (!userId) {
      return;
    }

    void refreshGrowthEntry({ autoOpenPopup: true }).catch((err) => {
      console.error("Failed to refresh growth entry:", err);
    });
  }, [refreshGrowthEntry, userId]);

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
    return selectHeroCharacters(discoverCharacters, heroCharacterIds);
  }, [discoverCharacters, heroCharacterIds]);

  // 处理角色选择
  const handleSelectCharacter = async (character: CharacterResponse | Character) => {
    try {
      const chatId = await openChatMutation.mutateAsync(character.id);
      router.push(`/chat/${chatId}`);
    } catch (err) {
      console.error("Failed to open chat:", err);
    }
  };

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
      llm_provider: character.llm_provider,
      llm_model: character.llm_model,
      uses_system_default_llm: character.uses_system_default_llm,
      effective_llm_provider: character.effective_llm_provider,
      effective_llm_model: character.effective_llm_model,
      distinct_user_count: character.distinct_user_count,
    }));
  }, [discoverCharacters]);

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
    <WorkspaceFrame>
      <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar bg-white">
        <div className="max-w-[1400px] mx-auto px-10 py-6 min-h-full flex flex-col">
          {/* 顶部控制台 */}
          <TopConsole
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            searchResults={searchResults}
            onSelectSearchResult={handleSelectCharacter}
          />

          {/* 主内容区 */}
          <div className="flex-1 pb-10">
            <div className="flex flex-col animate-in fade-in duration-500">
              {/* 巨幕轮播 */}
              <HeroCarousel
                characters={heroCharacters}
                onSelectCharacter={handleSelectCharacter}
              />

              {/* 全部角色横滑区 */}
              {mappedCharacters.length > 0 && (
                <HorizontalSection
                  title="全部角色"
                  characters={mappedCharacters}
                  onSelectCharacter={handleSelectCharacter}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </WorkspaceFrame>
  );
}
