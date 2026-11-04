export const HERO_TWEEN_FACTOR = 0.52;
export const HERO_OPACITY_TWEEN_FACTOR = 0.9;
export const HERO_MIN_SCALE = 0.85;
export const HERO_MIN_OPACITY = 0.5;

export interface HeroTweenLoopPoint {
  index: number;
  target: number;
}

export interface HeroTweenStyle {
  scale: number;
  opacity: number;
}

interface HeroCarouselTweenInput {
  scrollProgress: number;
  scrollSnaps: number[];
  slideRegistry: number[][];
  loop: boolean;
  loopPoints: HeroTweenLoopPoint[];
}

function inferSlideCount(slideRegistry: number[][]): number {
  return slideRegistry.reduce((maxSlideCount, slideIndexes) => {
    const highestSlideIndex = slideIndexes.reduce(
      (maxIndex, slideIndex) => Math.max(maxIndex, slideIndex),
      -1
    );

    return Math.max(maxSlideCount, highestSlideIndex + 1);
  }, 0);
}

export function computeHeroTweenStyles({
  scrollProgress,
  scrollSnaps,
  slideRegistry,
  loop,
  loopPoints,
}: HeroCarouselTweenInput): HeroTweenStyle[] {
  const slideCount = inferSlideCount(slideRegistry);
  const tweenStyles = Array.from({ length: slideCount }, () => ({
    scale: HERO_MIN_SCALE,
    opacity: HERO_MIN_OPACITY,
  }));

  scrollSnaps.forEach((scrollSnap, snapIndex) => {
    const slidesInSnap = slideRegistry[snapIndex] ?? [];

    slidesInSnap.forEach((slideIndex) => {
      let diffToTarget = scrollSnap - scrollProgress;

      if (loop) {
        loopPoints.forEach((loopPoint) => {
          if (slideIndex !== loopPoint.index) {
            return;
          }

          const target = loopPoint.target;
          if (target === 0) {
            return;
          }

          const sign = Math.sign(target);
          if (sign === -1) {
            diffToTarget = scrollSnap - (1 + scrollProgress);
          }
          if (sign === 1) {
            diffToTarget = scrollSnap + (1 - scrollProgress);
          }
        });
      }

      const tweenValue = 1 - Math.abs(diffToTarget * HERO_TWEEN_FACTOR);
      const opacityTweenValue =
        1 - Math.abs(diffToTarget * HERO_OPACITY_TWEEN_FACTOR);

      const nextTweenStyle = {
        scale: Math.max(HERO_MIN_SCALE, Number(tweenValue.toFixed(3))),
        opacity: Math.max(
          HERO_MIN_OPACITY,
          Number(opacityTweenValue.toFixed(3))
        ),
      };

      const currentTweenStyle = tweenStyles[slideIndex];
      if (
        nextTweenStyle.scale > currentTweenStyle.scale ||
        nextTweenStyle.opacity > currentTweenStyle.opacity
      ) {
        tweenStyles[slideIndex] = nextTweenStyle;
      }
    });
  });

  return tweenStyles;
}
