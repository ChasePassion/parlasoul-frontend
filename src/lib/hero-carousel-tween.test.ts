import assert from "node:assert/strict";
import test from "node:test";

import {
  HERO_MIN_OPACITY,
  HERO_MIN_SCALE,
  computeHeroTweenStyles,
} from "./hero-carousel-tween";

test("keeps the centered slide emphasized without relying on slidesInView", () => {
  const tweenStyles = computeHeroTweenStyles({
    scrollProgress: 0,
    scrollSnaps: [0, 0.35, 0.7],
    slideRegistry: [[0], [1], [2]],
    loop: false,
    loopPoints: [],
  });

  assert.deepEqual(tweenStyles[0], { scale: 1, opacity: 1 });
  assert.deepEqual(tweenStyles[1], {
    scale: HERO_MIN_SCALE,
    opacity: 0.685,
  });
  assert.deepEqual(tweenStyles[2], {
    scale: HERO_MIN_SCALE,
    opacity: HERO_MIN_OPACITY,
  });
});

test("applies tween values to visible side slides", () => {
  const tweenStyles = computeHeroTweenStyles({
    scrollProgress: 0,
    scrollSnaps: [0, 0.2, 0.4],
    slideRegistry: [[0], [1], [2]],
    loop: false,
    loopPoints: [],
  });

  assert.deepEqual(tweenStyles[0], { scale: 1, opacity: 1 });
  assert.deepEqual(tweenStyles[1], { scale: 0.896, opacity: 0.82 });
  assert.deepEqual(tweenStyles[2], { scale: HERO_MIN_SCALE, opacity: 0.64 });
});
