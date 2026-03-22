import { getMarketCharacters, type CharacterResponse } from "@/lib/api";
import { httpClient } from "./http-client";

const DISCOVER_PAGE_SIZE = 100;

// Discover 配置类型
export interface DiscoverConfig {
  hero_character_ids: string[];
}

/**
 * 分页拉取全部 market 角色数据
 */
export async function fetchAllMarketCharacters(): Promise<CharacterResponse[]> {
  const all: CharacterResponse[] = [];
  let skip = 0;

  while (true) {
    const batch = await getMarketCharacters(skip, DISCOVER_PAGE_SIZE);
    all.push(...batch);

    if (batch.length < DISCOVER_PAGE_SIZE) {
      break;
    }

    skip += batch.length;
  }

  return all;
}

/**
 * 获取 Discover 页运行时配置（Hero 角色 ID 列表等）
 */
export async function getDiscoverConfig(): Promise<DiscoverConfig> {
  return httpClient.get<DiscoverConfig>("/v1/discover/config");
}

/**
 * 按 hero_character_ids 从全量角色中选取 Hero 角色
 * 保持 ids 定义的顺序
 */
export function selectHeroCharacters(
  characters: CharacterResponse[],
  heroCharacterIds: string[]
): CharacterResponse[] {
  return heroCharacterIds
    .map((id) => characters.find((character) => character.id === id))
    .filter(
      (character): character is CharacterResponse => Boolean(character)
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
