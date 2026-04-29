import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";

const SPRITE_FILE_PATTERN = /^sprite-[a-f0-9]{12}\.svg$/;
const SPRITE_DIR = new URL("../../public/icons/", import.meta.url);
const PAINT_ATTRIBUTE_PATTERN = /\b(fill|stroke)="([^"]+)"/g;
const SYMBOL_PATTERN = /<symbol\b([^>]*)>([\s\S]*?)<\/symbol>/g;
const SHAPE_PATTERN = /<(path|circle|rect|line|polyline|polygon|ellipse)\b([^>]*)>/g;

const DYNAMIC_PAINT_VALUES = new Set(["currentcolor", "none", "transparent"]);
const PRESERVED_SYMBOL_PAINTS: Record<string, Set<string>> = {
  translate: new Set(["#1b7afe"]),
};

function isDynamicPaintValue(value: string) {
  const normalized = value.trim().toLowerCase();
  return DYNAMIC_PAINT_VALUES.has(normalized) || normalized.startsWith("url(");
}

function getAttributeValue(attributes: string, name: string) {
  const match = attributes.match(new RegExp(`\\s${name}="([^"]+)"`));
  return match?.[1];
}

function hasPaintAttribute(attributes: string) {
  return /\s(?:fill|stroke)="/.test(attributes);
}

test("generated icon sprite only keeps intentional hard-coded paint values", () => {
  const spriteFiles = readdirSync(SPRITE_DIR).filter((fileName) =>
    SPRITE_FILE_PATTERN.test(fileName)
  );

  assert.equal(spriteFiles.length, 1);

  const sprite = readFileSync(new URL(spriteFiles[0], SPRITE_DIR), "utf-8");
  const disallowedPaints: string[] = [];
  const paintlessSymbols: string[] = [];

  for (const symbolMatch of sprite.matchAll(SYMBOL_PATTERN)) {
    const [, attributes, content] = symbolMatch;
    const symbolId = getAttributeValue(attributes, "id");
    assert.ok(symbolId, "sprite symbol is missing an id");

    const symbolMarkup = `${attributes}>${content}`;
    const symbolHasInheritedPaint = hasPaintAttribute(attributes);

    for (const shapeMatch of content.matchAll(SHAPE_PATTERN)) {
      const [, shapeName, shapeAttributes] = shapeMatch;

      if (!hasPaintAttribute(shapeAttributes) && !symbolHasInheritedPaint) {
        paintlessSymbols.push(`${symbolId} ${shapeName}`);
      }
    }

    for (const paintMatch of symbolMarkup.matchAll(PAINT_ATTRIBUTE_PATTERN)) {
      const [, attribute, rawValue] = paintMatch;
      const normalizedValue = rawValue.trim().toLowerCase();
      const allowedStaticValues = PRESERVED_SYMBOL_PAINTS[symbolId];

      if (
        isDynamicPaintValue(rawValue) ||
        allowedStaticValues?.has(normalizedValue)
      ) {
        continue;
      }

      disallowedPaints.push(`${symbolId} ${attribute}=${rawValue}`);
    }
  }

  assert.deepEqual(disallowedPaints, []);
  assert.deepEqual(paintlessSymbols, []);
});
