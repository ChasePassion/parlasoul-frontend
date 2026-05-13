"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import type { EmblaCarouselType } from "embla-carousel";
import Autoplay from "embla-carousel-autoplay";
import Image from "next/image";
import { cn } from "@/lib/utils";

import type { CharacterResponse } from "@/lib/api-service";
import type { DiscoverHeroCharacter } from "@/lib/discover-data";
import { computeHeroTweenStyles } from "@/lib/hero-carousel-tween";
import { useIsMobile } from "@/hooks/useIsMobile";

// ── 动画参数 ──
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

interface HeroCarouselProps {
  characters: DiscoverHeroCharacter[];
  onSelectCharacter: (character: CharacterResponse) => void;
}

export default function HeroCarousel({
  characters,
  onSelectCharacter,
}: HeroCarouselProps) {
  const isMobile = useIsMobile();

  const [autoplay] = useState(() =>
    Autoplay({ delay: 3000, stopOnInteraction: false, playOnInit: false }),
  );

  const canLoop = characters.length >= 2;

  const [emblaRef, emblaApi] = useEmblaCarousel(
    {
      loop: canLoop,
      align: "center",
      skipSnaps: false,
    },
    [autoplay],
  );

  const selectedIndexRef = useRef(0);
  const [slideCount, setSlideCount] = useState(0);
  const dotsContainerRef = useRef<HTMLDivElement | null>(null);

  const tweenNodes = useRef<Array<HTMLElement | null>>([]);
  const wheelTargetIndex = useRef(0);

  // 获取所有需要做 tween 动画的 slide 节点
  const setTweenNodes = useCallback((api: EmblaCarouselType) => {
    tweenNodes.current = api.slideNodes().map((slideNode) => {
      return slideNode.querySelector(
        "[data-carousel-slide-inner]"
      ) as HTMLElement | null;
    });
  }, []);

  // Cover Flow 核心动画函数（仅桌面端）
  const tweenScale = useCallback((api: EmblaCarouselType) => {
    if (isMobile) return;

    const engine = api.internalEngine();
    const tweenStyles = computeHeroTweenStyles({
      scrollProgress: api.scrollProgress(),
      scrollSnaps: api.scrollSnapList(),
      slideRegistry: engine.slideRegistry,
      loop: engine.options.loop,
      loopPoints: engine.slideLooper.loopPoints.map((loopPoint) => ({
        index: loopPoint.index,
        target: loopPoint.target(),
      })),
    });

    tweenNodes.current.forEach((slideNode, slideIndex) => {
      const tweenStyle = tweenStyles[slideIndex];
      if (!slideNode || !tweenStyle) {
        return;
      }

      slideNode.style.transform = `scale(${tweenStyle.scale})`;
      slideNode.style.opacity = String(tweenStyle.opacity);
    });
  }, [isMobile]);

  // 绑定 Embla 事件（桌面端 tween 动画，移动端完全跳过）
  useEffect(() => {
    if (!emblaApi) return;

    setTweenNodes(emblaApi);

    if (isMobile) {
      return; // 移动端不需要任何 tween 事件绑定
    }

    tweenScale(emblaApi);

    let initialTweenFrameId = 0;
    let followupTweenFrameId = 0;

    initialTweenFrameId = window.requestAnimationFrame(() => {
      emblaApi.reInit();
      tweenScale(emblaApi);

      followupTweenFrameId = window.requestAnimationFrame(() => {
        tweenScale(emblaApi);
      });
    });

    const events: Array<Parameters<typeof emblaApi.on>[0]> = [
      "reInit", "select", "scroll", "settle", "slideFocus",
    ];

    events.forEach((event) => {
      if (event !== "reInit") {
        emblaApi.on(event, tweenScale);
      }
    });
    emblaApi.on("reInit", setTweenNodes).on("reInit", tweenScale);

    return () => {
      window.cancelAnimationFrame(initialTweenFrameId);
      window.cancelAnimationFrame(followupTweenFrameId);
      events.forEach((event) => {
        emblaApi.off(event, tweenScale);
      });
      emblaApi.off("reInit", setTweenNodes);
    };
  }, [emblaApi, setTweenNodes, tweenScale, isMobile]);

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
      const isVerticalIntent = absDeltaY > absDeltaX;

      if (!isHorizontalIntent && !isVerticalIntent) {
        resetWheelState();
        return;
      }

      e.preventDefault();

      const wheelDirection = isHorizontalIntent ? Math.sign(e.deltaX) : Math.sign(e.deltaY);
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

  // 移动端自动播放，桌面端停止
  useEffect(() => {
    if (!emblaApi) return;
    if (isMobile && characters.length >= 2) {
      autoplay.play();
    } else {
      autoplay.stop();
    }
  }, [isMobile, autoplay, emblaApi, characters.length]);

  // 移动端清除 Cover Flow tween 残留样式
  useEffect(() => {
    if (!isMobile) return;

    tweenNodes.current.forEach((node) => {
      if (node) {
        node.style.transform = "";
        node.style.opacity = "";
      }
    });
  }, [isMobile]);

  // 追踪当前选中 slide — slideCount 用 state 初始化渲染，selectedIndex 用 ref + DOM 避免 re-render
  useEffect(() => {
    if (!emblaApi) return;

    const updateDots = () => {
      const idx = emblaApi.selectedScrollSnap();
      selectedIndexRef.current = idx;
      const container = dotsContainerRef.current;
      if (!container) return;
      const dots = container.children;
      for (let i = 0; i < dots.length; i++) {
        const dot = dots[i] as HTMLElement;
        if (i === idx) {
          dot.classList.add("bg-white");
          dot.classList.remove("bg-white/40");
        } else {
          dot.classList.add("bg-white/40");
          dot.classList.remove("bg-white");
        }
      }
    };

    setSlideCount(emblaApi.scrollSnapList().length);
    updateDots();

    emblaApi.on("select", updateDots).on("reInit", () => {
      setSlideCount(emblaApi.scrollSnapList().length);
      updateDots();
    });

    return () => {
      emblaApi.off("select", updateDots);
    };
  }, [emblaApi]);

  if (characters.length === 0) return null;

  return (
    <div
      className="group/carousel relative"
      style={{
        marginTop: "16px",
        left: isMobile ? "unset" : "50%",
        transform: isMobile ? "none" : "translateX(-50%)",
        width: isMobile
          ? "100%"
          : `min(calc(100% + ${HERO_VIEWPORT_BLEED}px), ${HERO_VIEWPORT_MAX_WIDTH}px)`,
      }}
    >
      {/* Embla Viewport */}
      <div
        className="overflow-hidden rounded-[20px]"
        ref={emblaRef}
      >
        <div className={cn("flex touch-pan-y", isMobile && "will-change-transform")}>
          {characters.map((item, i) => (
            <div
              key={item.character.id}
              className={cn("shrink-0 min-w-0", isMobile ? "" : "px-1")}
              style={{
                flex: isMobile ? "0 0 100%" : `0 0 ${HERO_SLIDE_BASIS}`,
              }}
            >
              <div
                data-carousel-slide-inner
                className={cn(
                  "relative w-full overflow-hidden rounded-[20px]",
                  !isMobile && "transition-[transform,opacity] duration-100 ease-out",
                )}
                style={{
                  aspectRatio: HERO_ASPECT_RATIO,
                  maxHeight: HERO_MAX_HEIGHT,
                  ...(isMobile
                    ? { cursor: "pointer" }
                    : { willChange: "transform, opacity" }),
                }}
                onClick={
                  isMobile
                    ? () => onSelectCharacter(item.character)
                    : undefined
                }
              >
                {/* 背景图片 */}
                <Image
                  src={item.imageUrl}
                  alt={item.character.name}
                  fill
                  className="object-contain object-center"
                  priority={i === 0}
                  sizes={isMobile ? "100vw" : `${HERO_SLIDE_MAX_WIDTH}px`}
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

                {/* CTA 按钮 - 玻璃拟态（仅桌面端） */}
                {!isMobile && (
                <div className="absolute bottom-6 left-0 right-0 z-20 flex justify-center">
                  <button
                    className="group/btn relative flex items-center gap-1.5 px-5 py-2.5 text-sm font-medium text-white/95 rounded-[16px] cursor-pointer overflow-hidden transition-all duration-300 ease-out hover:[&>span:last-child]:translate-x-1"
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
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'linear-gradient(135deg, rgba(255, 255, 255, 0.35) 0%, rgba(255, 255, 255, 0.15) 100%)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'linear-gradient(135deg, rgba(255, 255, 255, 0.15) 0%, rgba(255, 255, 255, 0.05) 100%)';
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectCharacter(item.character);
                    }}
                  >
                    <span>{item.ctaText}</span>
                    <span
                      className="inline-block transition-transform duration-200 ease-out"
                    >
                      →
                    </span>
                  </button>
                </div>
                )}

                {/* 悬浮阴影（仅桌面端，移动端省去避免 paint 开销） */}
                {!isMobile && (
                  <div
                    className="absolute inset-0 rounded-[20px] pointer-events-none"
                    style={{
                      boxShadow: "0 20px 40px rgba(0,0,0,0.1)",
                    }}
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 轮播圆点指示器（仅移动端，用 ref + DOM 操作避免 setState 触发 re-render） */}
      {isMobile && slideCount > 1 && (
        <div
          ref={dotsContainerRef}
          className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex gap-2 pointer-events-none"
        >
          {Array.from({ length: slideCount }).map((_, i) => (
            <span
              key={i}
              className={cn(
                "block w-2 h-2 rounded-full transition-colors duration-300",
                i === 0 ? "bg-white" : "bg-white/40",
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
