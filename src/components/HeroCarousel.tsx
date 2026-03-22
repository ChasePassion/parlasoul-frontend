"use client";

import { useCallback, useEffect, useRef } from "react";
import useEmblaCarousel from "embla-carousel-react";
import type { EmblaCarouselType } from "embla-carousel";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { CharacterResponse } from "@/lib/api-service";
import { resolveCharacterAvatarSrc } from "@/lib/character-avatar";

// ── 动画参数 ──
const TWEEN_FACTOR = 0.52;
const MIN_SCALE = 0.85;
const MIN_OPACITY = 0.5;

// ── Hero 静态图片映射 ──
// 通过角色名称匹配 public 目录下的图片，找不到时使用 avatar
function getHeroImage(character: CharacterResponse): string {
  const normalizedName = character.name.toLowerCase().replace(/\s+/g, " ").trim();
  if (normalizedName.includes("elon")) return "/Elon.png";
  if (normalizedName.includes("gork")) return "/Gork.png";
  if (
    normalizedName.includes("xiao bai") ||
    normalizedName.includes("xiaobai") ||
    normalizedName.includes("小白")
  ) {
    return "/Bai.png";
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
        const opacity = Math.max(
          MIN_OPACITY,
          Number(tweenValue.toFixed(3))
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

  // 导航按钮状态
  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  if (characters.length === 0) return null;

  return (
    <div className="relative w-full" style={{ marginTop: "32px" }}>
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
              style={{ flex: "0 0 min(80%, 640px)" }}
            >
              <div
                data-carousel-slide-inner
                className="relative w-full overflow-hidden rounded-[20px] transition-[transform,opacity] duration-100 ease-out"
                style={{
                  aspectRatio: "16 / 9",
                  maxHeight: "360px",
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
                  sizes="(max-width: 768px) 80vw, 640px"
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

                {/* CTA 按钮 */}
                <div className="absolute bottom-6 left-0 right-0 z-20 flex justify-center">
                  <Button
                    variant="default"
                    size="lg"
                    className="bg-white text-gray-900 hover:bg-white/90 rounded-lg px-6 py-2.5 font-medium text-sm shadow-lg transition-transform duration-200 hover:scale-105 cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectCharacter(character);
                    }}
                  >
                    开始对话 →
                  </Button>
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

      {/* 左侧导航按钮 */}
      <button
        onClick={scrollPrev}
        className="absolute left-4 top-1/2 -translate-y-1/2 z-30 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-105 cursor-pointer"
        style={{
          backgroundColor: "rgba(255,255,255,0.9)",
          boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
        }}
        aria-label="上一张"
      >
        <ChevronLeft className="w-5 h-5 text-gray-800" />
      </button>

      {/* 右侧导航按钮 */}
      <button
        onClick={scrollNext}
        className="absolute right-4 top-1/2 -translate-y-1/2 z-30 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-105 cursor-pointer"
        style={{
          backgroundColor: "rgba(255,255,255,0.9)",
          boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
        }}
        aria-label="下一张"
      >
        <ChevronRight className="w-5 h-5 text-gray-800" />
      </button>
    </div>
  );
}
