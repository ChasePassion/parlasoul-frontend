import assert from "node:assert/strict";
import test from "node:test";

import { computeCardPosition } from "./positioning";

const viewport = { width: 1440, height: 900 };
const card = { width: 340, height: 220 };

test("anchors the card to a mid-screen target instead of the viewport corner", () => {
  const hole = { x: 1050, y: 300, width: 120, height: 60 };
  const position = computeCardPosition(hole, card, viewport, "top");

  assert.ok(position);
  assert.equal(position.side, "top");
  assert.ok(position.x > 800, `expected a right-side x, got ${position.x}`);
  assert.ok(
    Math.abs(position.x + card.width / 2 - (hole.x + hole.width / 2)) < 1,
  );
  assert.ok(position.y + card.height <= viewport.height - 16);
});

test("flips above a bottom-edge target so the card stays fully visible", () => {
  const hole = { x: 1000, y: 830, width: 60, height: 40 };
  const position = computeCardPosition(hole, card, viewport, "bottom");

  assert.ok(position);
  assert.equal(position.side, "top");
  assert.ok(position.y >= 16);
  assert.ok(position.y + card.height <= viewport.height - 16);
  assert.ok(position.x + card.width <= viewport.width - 16);
});

test("clamps horizontal placement on a narrow viewport", () => {
  const narrow = { width: 380, height: 700 };
  const position = computeCardPosition(
    { x: 200, y: 100, width: 100, height: 40 },
    { width: 348, height: 220 },
    narrow,
    "bottom-start",
  );

  assert.ok(position);
  assert.ok(position.x >= 16);
  assert.ok(position.x + 348 <= narrow.width - 16);
});

test("rejects degenerate hole, card and viewport sizes", () => {
  assert.equal(
    computeCardPosition(
      { x: 0, y: 0, width: 1, height: 1 },
      { width: 0, height: 0 },
      viewport,
    ),
    null,
  );
  assert.equal(
    computeCardPosition({ x: 0, y: 0, width: 0, height: 0 }, card, viewport),
    null,
  );
  assert.equal(
    computeCardPosition(
      { x: 0, y: 0, width: 100, height: 40 },
      card,
      { width: 0, height: 0 },
    ),
    null,
  );
});
