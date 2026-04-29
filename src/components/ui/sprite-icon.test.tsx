import assert from "node:assert/strict";
import test from "node:test";
import * as React from "react";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

test("uses currentColor by default so parent UI selectors do not force muted icon colors", async () => {
  const { SpriteIcon } = await import("./sprite-icon");
  const icon = SpriteIcon({ name: "out" });

  assert.equal(icon.props.fill, "currentColor");
  assert.match(icon.props.className, /\btext-current\b/);
});

test("keeps explicit text color overrides", async () => {
  const { SpriteIcon } = await import("./sprite-icon");
  const icon = SpriteIcon({
    name: "delete",
    className: "shrink-0 text-red-600",
  });

  assert.match(icon.props.className, /\btext-red-600\b/);
  assert.doesNotMatch(icon.props.className, /\btext-current\b/);
});
