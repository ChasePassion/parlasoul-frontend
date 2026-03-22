"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronRight } from "lucide-react";
import type { Character } from "@/components/Sidebar";
import CharacterCard from "@/components/CharacterCard";

const SCROLL_TOLERANCE = 2;

function getScrollMaskImage(showLeftFade: boolean, showRightFade: boolean) {
  if (showLeftFade && showRightFade) {
    return "linear-gradient(to right, rgba(0,0,0,0) 0px, rgba(0,0,0,0.1) 8px, rgba(0,0,0,0.3) 18px, rgba(0,0,0,0.7) 35px, black 48px, black calc(100% - 48px), rgba(0,0,0,0.7) calc(100% - 35px), rgba(0,0,0,0.3) calc(100% - 18px), rgba(0,0,0,0.1) calc(100% - 8px), transparent 100%)";
  }

  if (showLeftFade) {
    return "linear-gradient(to right, rgba(0,0,0,0) 0px, rgba(0,0,0,0.1) 8px, rgba(0,0,0,0.3) 18px, rgba(0,0,0,0.7) 35px, black 48px, black 100%)";
  }

  if (showRightFade) {
    return "linear-gradient(to right, black 0px, black calc(100% - 48px), rgba(0,0,0,0.7) calc(100% - 35px), rgba(0,0,0,0.3) calc(100% - 18px), rgba(0,0,0,0.1) calc(100% - 8px), transparent 100%)";
  }

  return "linear-gradient(to right, black 0px, black 100%)";
}

interface HorizontalSectionProps {
  title: string;
  hint?: string;
  characters: Character[];
  onSelectCharacter: (character: Character) => void;
}

export default function HorizontalSection({
  title,
  hint = "右滑查看全部",
  characters,
  onSelectCharacter,
}: HorizontalSectionProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const maskImage = getScrollMaskImage(canScrollLeft, canScrollRight);

  // 检测左右两侧是否还可以滚动
  const checkScrollBounds = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const maxScrollLeft = el.scrollWidth - el.clientWidth;
    const hasMoreRight = maxScrollLeft - el.scrollLeft > SCROLL_TOLERANCE;
    const hasMoreLeft = el.scrollLeft > SCROLL_TOLERANCE;
    setCanScrollRight(hasMoreRight);
    setCanScrollLeft(hasMoreLeft);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    // 初始化检测
    checkScrollBounds();

    // 内容变化后重新检测
    const resizeObserver = new ResizeObserver(() => {
      checkScrollBounds();
    });
    resizeObserver.observe(el);

    return () => {
      resizeObserver.disconnect();
    };
  }, [checkScrollBounds, characters.length]);

  // 监听滚动事件
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          checkScrollBounds();
          ticking = false;
        });
        ticking = true;
      }
    };

    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [checkScrollBounds]);

  return (
    <section className="relative mt-10">
      {/* 分区标题栏 */}
      <div className="flex items-center justify-between mb-4 px-1">
        <h2 className="text-lg font-semibold text-[#0d0d0d] flex items-center gap-2">
          <span className="text-base">✨</span>
          {title}
        </h2>
        <span className="text-sm text-[#5d5d5d] flex items-center gap-1">
          {hint}
          <ChevronRight className="w-4 h-4" strokeWidth={1.5} />
        </span>
      </div>


      <div
        className="relative"
        style={{
          maskImage,
          WebkitMaskImage: maskImage,
        }}
      >
        <div
          ref={scrollRef}
          role="region"
          aria-label="全部角色列表"
          tabIndex={0}
          className="flex gap-6 overflow-x-auto pb-4 scrollbar-hide outline-none"
          style={{
            scrollPaddingLeft: 0,
            scrollbarWidth: "none",
            msOverflowStyle: "none",
          }}
        >
          {characters.map((character) => (
            <div
              key={character.id}
              className="flex-[0_0_300px]"
            >
              <CharacterCard
                character={character}
                onClick={onSelectCharacter}
              />
            </div>
          ))}
        </div>


        {canScrollRight && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
            <ChevronRight
              className="w-5 h-5 text-gray-400"
              strokeWidth={1.5}
            />
          </div>
        )}
      </div>
    </section>
  );
}
