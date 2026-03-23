"use client";

import { useCallback, useEffect, useRef } from "react";
import useEmblaCarousel from "embla-carousel-react";
import type { EmblaCarouselType } from "embla-carousel";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";

import type { CharacterResponse } from "@/lib/api-service";
import { resolveCharacterAvatarSrc } from "@/lib/character-avatar";

// ── 动画参数 ──
const TWEEN_FACTOR = 0.52;
const OPACITY_TWEEN_FACTOR = 0.9;
const MIN_SCALE = 0.85;
const MIN_OPACITY = 0.5;
const HERO_ASPECT_RATIO = "21 / 9";
const HERO_VIEWPORT_MAX_WIDTH = 1040;
const HERO_VIEWPORT_BLEED = 80;
const HERO_SLIDE_MAX_WIDTH = 720;
const HERO_SLIDE_BASIS = `min(84%, ${HERO_SLIDE_MAX_WIDTH}px)`;
const HERO_MAX_HEIGHT = `${Math.round((HERO_SLIDE_MAX_WIDTH * 9) / 21)}px`;
const WHEEL_STEP_PX = 400;
const WHEEL_RESET_MS = 180;
const WHEEL_MIN_DELTA_X = 12;
const WHEEL_AXIS_LOCK_RATIO = 1.25;

// ── Hero 静态图片映射 ──
// 通过角色名称匹配 public 目录下的图片，找不到时使用 avatar
function getHeroImage(character: CharacterResponse): string {
  const normalizedName = character.name.toLowerCase().replace(/\s+/g, " ").trim();
  if (normalizedName.includes("elon")) return "/Elon-21-9.jpg";
  if (normalizedName.includes("gork")) return "/Gork-21-9.jpg";
  if (
    normalizedName.includes("xiao bai") ||
    normalizedName.includes("xiaobai") ||
    normalizedName.includes("小白")
  ) {
    return "/Bai-21-9.jpg";
  }
  return resolveCharacterAvatarSrc(character.avatar_file_name);
}

interface HeroCarouselProps {
  characters: CharacterResponse[];
  onSelectCharacter: (character: CharacterResponse) => void;
}

export default function HeroCarousel({
  characters,
  onSelectCharacter,
}: HeroCarouselProps) {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: true,
    align: "center",
    skipSnaps: false,
  });

  const tweenNodes = useRef<HTMLElement[]>([]);
  const wheelTargetIndex = useRef(0);

  // 获取所有需要做 tween 动画的 slide 节点
  const setTweenNodes = useCallback((api: EmblaCarouselType) => {
    tweenNodes.current = api.slideNodes().map((slideNode) => {
      return slideNode.querySelector(
        "[data-carousel-slide-inner]"
      ) as HTMLElement;
    });
  }, []);

  // Cover Flow 核心动画函数
  const tweenScale = useCallback((api: EmblaCarouselType) => {
    const engine = api.internalEngine();
    const scrollProgress = api.scrollProgress();
    const slidesInView = api.slidesInView();

    api.scrollSnapList().forEach((scrollSnap, snapIndex) => {
      let diffToTarget = scrollSnap - scrollProgress;
      const slidesInSnap = engine.slideRegistry[snapIndex];

      slidesInSnap.forEach((slideIndex) => {
        // 只计算可视区域内的卡片
        if (!slidesInView.includes(slideIndex)) return;

        // 处理 loop 循环时的边界计算
        if (engine.options.loop) {
          engine.slideLooper.loopPoints.forEach((loopPoint) => {
            const target = loopPoint.target();
            if (slideIndex === loopPoint.index && target !== 0) {
              const sign = Math.sign(target);
              if (sign === -1)
                diffToTarget = scrollSnap - (1 + scrollProgress);
              if (sign === 1)
                diffToTarget = scrollSnap + (1 - scrollProgress);
            }
          });
        }

        // 计算动画值
        const tweenValue = 1 - Math.abs(diffToTarget * TWEEN_FACTOR);
        const scale = Math.max(
          MIN_SCALE,
          Number(tweenValue.toFixed(3))
        );
        const opacityTweenValue = 1 - Math.abs(diffToTarget * OPACITY_TWEEN_FACTOR);
        const opacity = Math.max(
          MIN_OPACITY,
          Number(opacityTweenValue.toFixed(3))
        );

        // 应用到 DOM
        const slideNode = tweenNodes.current[slideIndex];
        if (slideNode) {
          slideNode.style.transform = `scale(${scale})`;
          slideNode.style.opacity = String(opacity);
        }
      });
    });
  }, []);

  // 绑定 Embla 事件
  useEffect(() => {
    if (!emblaApi) return;
    setTweenNodes(emblaApi);
    tweenScale(emblaApi);

    emblaApi
      .on("reInit", setTweenNodes)
      .on("reInit", tweenScale)
      .on("scroll", tweenScale)
      .on("slideFocus", tweenScale);

    return () => {
      emblaApi
        .off("reInit", setTweenNodes)
        .off("reInit", tweenScale)
        .off("scroll", tweenScale)
        .off("slideFocus", tweenScale);
    };
  }, [emblaApi, setTweenNodes, tweenScale]);

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;

    wheelTargetIndex.current = emblaApi.selectedScrollSnap();

    const syncWheelTarget = () => {
      wheelTargetIndex.current = emblaApi.selectedScrollSnap();
    };

    const viewport = emblaApi.rootNode();
    if (!viewport) return;

    let accumulatedDelta = 0;
    let lastWheelDirection = 0;
    let gestureBaseIndex = wheelTargetIndex.current;
    let pendingStepDelta = 0;
    let resetTimeout: number | null = null;

    const resetWheelState = () => {
      accumulatedDelta = 0;
      lastWheelDirection = 0;
      pendingStepDelta = 0;
      if (resetTimeout !== null) {
        window.clearTimeout(resetTimeout);
        resetTimeout = null;
      }
    };

    const commitWheelGesture = () => {
      const snapCount = emblaApi.scrollSnapList().length;
      if (snapCount > 0 && pendingStepDelta !== 0) {
        const nextIndex =
          ((gestureBaseIndex + pendingStepDelta) % snapCount + snapCount) %
          snapCount;

        wheelTargetIndex.current = nextIndex;
        emblaApi.scrollTo(nextIndex);
      }

      resetWheelState();
    };

    const handleWheel = (e: WheelEvent) => {
      const absDeltaX = Math.abs(e.deltaX);
      const absDeltaY = Math.abs(e.deltaY);
      const isHorizontalIntent =
        absDeltaX >= WHEEL_MIN_DELTA_X &&
        absDeltaX > absDeltaY * WHEEL_AXIS_LOCK_RATIO;

      if (!isHorizontalIntent) {
        resetWheelState();
        return;
      }

      e.preventDefault();

      const wheelDirection = Math.sign(e.deltaX);
      if (lastWheelDirection === 0) {
        gestureBaseIndex = wheelTargetIndex.current;
      }

      if (
        lastWheelDirection !== 0 &&
        wheelDirection !== 0 &&
        wheelDirection !== lastWheelDirection
      ) {
        accumulatedDelta = 0;
        pendingStepDelta = 0;
        gestureBaseIndex = wheelTargetIndex.current;
      }

      lastWheelDirection = wheelDirection || lastWheelDirection;
      accumulatedDelta += e.deltaX;

      if (resetTimeout !== null) {
        window.clearTimeout(resetTimeout);
      }

      resetTimeout = window.setTimeout(commitWheelGesture, WHEEL_RESET_MS);

      pendingStepDelta = Math.trunc(accumulatedDelta / WHEEL_STEP_PX);
    };

    emblaApi.on("select", syncWheelTarget).on("reInit", syncWheelTarget);
    viewport.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      emblaApi.off("select", syncWheelTarget).off("reInit", syncWheelTarget);
      viewport.removeEventListener("wheel", handleWheel);
      resetWheelState();
    };
  }, [emblaApi]);

  if (characters.length === 0) return null;

  return (
    <div
      className="group/carousel relative"
      style={{
        marginTop: "16px",
        left: "50%",
        transform: "translateX(-50%)",
        width: `min(calc(100% + ${HERO_VIEWPORT_BLEED}px), ${HERO_VIEWPORT_MAX_WIDTH}px)`,
      }}
    >
      {/* Embla Viewport */}
      <div
        className="overflow-hidden rounded-[20px]"
        ref={emblaRef}
      >
        <div className="flex touch-pan-y">
          {characters.map((character) => (
            <div
              key={character.id}
              className="shrink-0 min-w-0 px-1"
              style={{ flex: `0 0 ${HERO_SLIDE_BASIS}` }}
            >
              <div
                data-carousel-slide-inner
                className="relative w-full overflow-hidden rounded-[20px] transition-[transform,opacity] duration-100 ease-out"
                style={{
                  aspectRatio: HERO_ASPECT_RATIO,
                  maxHeight: HERO_MAX_HEIGHT,
                  willChange: "transform, opacity",
                }}
              >
                {/* 背景图片 */}
                <Image
                  src={getHeroImage(character)}
                  alt={character.name}
                  fill
                  className="object-contain object-center"
                  priority
                  sizes={`(max-width: 768px) 84vw, ${HERO_SLIDE_MAX_WIDTH}px`}
                />

                {/* 底部渐变遮罩 */}
                <div
                  className="absolute bottom-0 left-0 right-0 z-10"
                  style={{
                    height: "50%",
                    background:
                      "linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.4) 50%, rgba(0,0,0,0) 100%)",
                  }}
                />

                {/* CTA 按钮 - 玻璃拟态 */}
                <div className="absolute bottom-6 left-0 right-0 z-20 flex justify-center">
                  <button
                    className="relative flex items-center gap-1.5 px-5 py-2.5 text-sm font-medium text-white/95 rounded-[16px] cursor-pointer overflow-hidden transition-all duration-300 ease-out hover:scale-[1.02] hover:[&>span:last-child]:translate-x-1"
                    style={{
                      background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.15) 0%, rgba(255, 255, 255, 0.05) 100%)',
                      backdropFilter: 'blur(20px) saturate(180%)',
                      WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                      border: '1px solid rgba(255, 255, 255, 0.35)',
                      boxShadow: `
                        0 8px 32px rgba(0, 0, 0, 0.2),
                        inset 0 1px 0 rgba(255, 255, 255, 0.4),
                        inset 0 -1px 0 rgba(255, 255, 255, 0.1)
                      `,
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectCharacter(character);
                    }}
                  >
                    <span>开始对话</span>
                    <span
                      className="inline-block transition-transform duration-200 ease-out"
                    >
                      →
                    </span>
                  </button>
                </div>


                {/* 悬浮阴影 */}
                <div
                  className="absolute inset-0 rounded-[20px] pointer-events-none"
                  style={{
                    boxShadow: "0 20px 40px rgba(0,0,0,0.1)",
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={scrollPrev}
        className="absolute left-4 top-1/2 -translate-y-1/2 z-30 flex h-10 w-11 items-center justify-center rounded-full border border-white/30 bg-white/85 text-gray-800 shadow-md cursor-pointer transition-all duration-200 hover:scale-105 hover:bg-white"
        aria-label="上一张"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>

      <button
        onClick={scrollNext}
        className="absolute right-4 top-1/2 -translate-y-1/2 z-30 flex h-10 w-11 items-center justify-center rounded-full border border-white/30 bg-white/85 text-gray-800 shadow-md cursor-pointer transition-all duration-200 hover:scale-105 hover:bg-white"
        aria-label="下一张"
      >
        <ChevronRight className="h-5 w-5" />
      </button>
    </div>
  );
}
