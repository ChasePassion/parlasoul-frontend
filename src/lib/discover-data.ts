import { getMarketCharacters, type CharacterResponse } from "@/lib/api";
import { httpClient } from "./http-client";

const DISCOVER_PAGE_SIZE = 100;

// Discover 配置类型
export interface DiscoverHeroItem {
  character_id: string;
  image_key: string;
  image_url: string;
  cta_text?: string | null;
}

export interface DiscoverConfig {
  hero_character_ids: string[];
  hero_items: DiscoverHeroItem[];
  story_character_ids: string[];
}

export interface DiscoverHeroCharacter {
  character: CharacterResponse;
  imageUrl: string;
  ctaText: string;
}

/**
 * 分页拉取全部 market 角色数据
 */
export async function fetchAllMarketCharacters(
  options: { signal?: AbortSignal } = {},
): Promise<CharacterResponse[]> {
  const MAX_PAGES = 200;
  const all: CharacterResponse[] = [];
  let skip = 0;

  for (let page = 0; page < MAX_PAGES; page++) {
    const batch = await getMarketCharacters(
      skip,
      DISCOVER_PAGE_SIZE,
      options,
    );
    all.push(...batch);

    if (batch.length < DISCOVER_PAGE_SIZE) {
      break;
    }

    skip += batch.length;
  }

  return all;
}

/**
 * 获取 Discover 页运行时配置（Hero 角色和专用轮播图等）
 */
export async function getDiscoverConfig(
  options: { signal?: AbortSignal } = {},
): Promise<DiscoverConfig> {
  return httpClient.get<DiscoverConfig>("/v1/discover/config", options);
}

/**
 * 按 hero_items 从全量角色中选取 Hero 角色，并保留后端配置的图片。
 * 保持 hero_items 定义的顺序。
 */
export function selectHeroCharacters(
  characters: CharacterResponse[],
  heroItems: DiscoverHeroItem[]
): DiscoverHeroCharacter[] {
  return heroItems
    .map((item) => {
      const character = characters.find(
        (current) => current.id === item.character_id
      );
      if (!character) {
        return null;
      }
      return {
        character,
        imageUrl: item.image_url,
        ctaText: item.cta_text?.trim() || "开始对话",
      };
    })
    .filter(
      (item): item is DiscoverHeroCharacter => Boolean(item)
    );
}

/**
 * 本地名称搜索：trim + 小写化 + includes
 */
export function filterCharactersByName(
  characters: CharacterResponse[],
  query: string
): CharacterResponse[] {
  const normalized = query.trim().toLocaleLowerCase();

  if (!normalized) return [];

  return characters.filter((character) =>
    character.name.toLocaleLowerCase().includes(normalized)
  );
}
