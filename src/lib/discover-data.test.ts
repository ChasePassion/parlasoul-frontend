import assert from "node:assert/strict";
import test from "node:test";

import type { CharacterResponse } from "@/lib/api-service";

import { selectHeroCharacters } from "./discover-data";

function character(id: string, name: string): CharacterResponse {
  return {
    id,
    name,
    description: "",
    system_prompt: "",
    voice_provider: "dashscope",
    voice_model: "cosyvoice-v2",
    voice_provider_voice_id: "Cherry",
    voice_source_type: "system",
    creator_id: null,
    status: "ACTIVE",
    visibility: "PUBLIC",
    distinct_user_count: 0,
  };
}

test("selects hero characters in config order with configured image urls", () => {
  const result = selectHeroCharacters(
    [character("character-2", "Gork"), character("character-1", "Elon")],
    [
      {
        character_id: "character-1",
        image_key: "images/discover/heroes/elon-21-9.jpg",
        image_url: "/media/images/discover/heroes/elon-21-9.jpg",
        cta_text: " 开始对话 ",
      },
      {
        character_id: "missing-character",
        image_key: "images/discover/heroes/missing.jpg",
        image_url: "/media/images/discover/heroes/missing.jpg",
      },
      {
        character_id: "character-2",
        image_key: "images/discover/heroes/gork-21-9.jpg",
        image_url: "/media/images/discover/heroes/gork-21-9.jpg",
        cta_text: "",
      },
    ],
  );

  assert.deepEqual(
    result.map((item) => ({
      characterId: item.character.id,
      imageUrl: item.imageUrl,
      ctaText: item.ctaText,
    })),
    [
      {
        characterId: "character-1",
        imageUrl: "/media/images/discover/heroes/elon-21-9.jpg",
        ctaText: "开始对话",
      },
      {
        characterId: "character-2",
        imageUrl: "/media/images/discover/heroes/gork-21-9.jpg",
        ctaText: "开始对话",
      },
    ],
  );
});
