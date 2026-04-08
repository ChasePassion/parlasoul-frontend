"use client";

import Image from "next/image";
import type { Character } from "./Sidebar";
import { MoreHorizontal } from "lucide-react";
import { CHARACTER_CARD_VISIBLE_TAGS, normalizeCharacterTag } from "@/lib/character-tags";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Card, CardContent } from "@/components/ui/card";

interface CharacterCardProps {
  character: Character;
  onClick: (character: Character) => void;
  showMenu?: boolean;
  onEdit?: (character: Character) => void;
  onUnpublish?: (character: Character) => void;
  disableHoverFloat?: boolean;
}

export default function CharacterCard({
  character,
  onClick,
  showMenu = false,
  onEdit,
  onUnpublish,
  disableHoverFloat = false,
}: CharacterCardProps) {
  const tags = (character.tags ?? [])
    .map((tag) => normalizeCharacterTag(tag))
    .filter((tag) => tag.length > 0);
  const visibleTags = tags.slice(0, CHARACTER_CARD_VISIBLE_TAGS);
  const hiddenTags = tags.slice(CHARACTER_CARD_VISIBLE_TAGS);
  const isUnpublished = character.status === "UNPUBLISHED";

  return (
    <Card
      onClick={() => onClick(character)}
      className={cn(
        "group p-0 bg-transparent flex-row gap-0 relative block h-[130px] rounded-[20px] overflow-hidden no-underline shadow-none border border-white/10 transition-all duration-500 cursor-pointer hover:shadow-none"
      )}
    >
      <div
        className={cn(
          "absolute inset-[-30px] bg-cover bg-center blur-xl scale-110 z-10 transition-all duration-700 ease-out",
          !disableHoverFloat && "group-hover:blur-sm group-hover:scale-125"
        )}
        style={{ backgroundImage: `url(${character.avatar})` }}
      />

      <div
        className={cn(
          "absolute inset-0 z-20 rounded-[20px] transition-all duration-700 ease-out",
          !disableHoverFloat && "group-hover:opacity-40"
        )}
        style={{
          backgroundColor: 'var(--cc-card-bg-blur)',
          backgroundImage: 'var(--cc-card-bg-gradient)',
          border: '1px solid var(--cc-card-border)',
        }}
      />

      <CardContent className="px-0 relative z-30 flex h-full p-3 gap-3 box-border">
        <div className="w-[84px] h-[106px] rounded-[14px] overflow-hidden shadow-(--cc-avatar-shadow) border border-white/10 relative shrink-0">
          <Image src={character.avatar} alt={character.name} fill className="object-cover" />
        </div>

        <div className="flex-1 flex flex-col justify-center min-w-0">
          <div className="flex justify-between items-center mb-1.5 gap-2">
            <div className="min-w-0 flex items-center gap-2">
              <h3 className="text-base font-bold text-white m-0 whitespace-nowrap overflow-hidden text-ellipsis drop-shadow-(--cc-text-shadow) tracking-wide">
                {character.name}
              </h3>
              {isUnpublished ? (
                <span className="shrink-0 rounded-md bg-amber-100/90 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-amber-700">
                  已下架
                </span>
              ) : null}
            </div>
            <span className="text-[13px] font-medium shrink-0 inline-flex items-center gap-1 leading-none text-(--cc-text-secondary)">
              {character.distinct_user_count != null
                ? character.distinct_user_count >= 1000
                  ? `${(character.distinct_user_count / 1000).toFixed(1)}k`
                  : String(character.distinct_user_count)
                : '-'}
              <svg width="14" height="14" viewBox="0 0 1024 1024" style={{ color: 'currentColor' }}><path d="M512 838c-39.98 0-78.592-5.132-115.02-14.686-23.648-6.2-88.642 15.36-194.98 64.686 28.444-92.068 35.188-144.976 20.232-158.724C153.926 666.49 112 581.53 112 488c0-193.3 179.086-350 400-350s400 156.7 400 350-179.086 350-400 350z m-159-304c24.852 0 45-20.148 45-45S377.852 444 353 444 308 464.148 308 489s20.148 45 45 45z m160 0c24.852 0 45-20.148 45-45S537.852 444 513 444 468 464.148 468 489s20.148 45 45 45z m160 0c24.852 0 45-20.148 45-45S697.852 444 673 444 628 464.148 628 489s20.148 45 45 45z" fill="currentColor"></path></svg>
            </span>
          </div>

          <p className="text-xs text-(--cc-text-muted) leading-5 m-0 mb-1.5 line-clamp-2 drop-shadow-(--cc-text-shadow-light)">
            {character.description}
          </p>

          {tags.length > 0 && (
            <div className={cn("flex gap-2 mt-auto min-w-0 items-center flex-nowrap", showMenu && "pr-10")}>
              {visibleTags.map((tag) => (
                <span
                  key={tag}
                  className="bg-(--cc-tag-bg) text-(--cc-tag-text) text-[11px] font-semibold py-1 px-[10px] rounded-md tracking-wide shadow-[inset_0_1px_0_var(--cc-tag-border)] inline-flex items-center min-w-0 max-w-[112px] shrink"
                  title={tag}
                >
                  <span className="block overflow-hidden whitespace-nowrap text-ellipsis">{tag}</span>
                </span>
              ))}

              {hiddenTags.length > 0 && (
                <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="border border-(--cc-tag-overflow-border) cursor-pointer shrink-0 bg-(--cc-tag-bg) text-(--cc-tag-text) text-[11px] font-semibold py-1 px-[10px] rounded-md tracking-wide hover:bg-(--cc-tag-overflow-hover) transition-colors"
                        aria-label={`查看全部标签，共 ${tags.length} 个`}
                      >
                        +{hiddenTags.length}
                      </button>
                    </PopoverTrigger>

                    <PopoverContent
                      side="top"
                      align="start"
                      sideOffset={10}
                      className="min-w-[180px] max-w-[220px] p-[10px] rounded-[14px] bg-(--cc-tag-overflow-bg) border border-(--cc-tag-overflow-border) shadow-[0_14px_36px_rgba(0,0,0,0.28)] backdrop-blur-md z-100"
                    >
                      <p className="m-0 mb-2 text-[11px] font-bold text-(--cc-text-secondary) tracking-wider">
                        全部标签
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {tags.map((tag) => (
                          <span
                            key={`overflow-${tag}`}
                            className="bg-(--cc-tag-bg) text-(--cc-tag-text) text-[11px] font-semibold py-1 px-[10px] rounded-md tracking-wide shadow-[inset_0_1px_0_var(--cc-tag-border)] inline-flex items-center min-w-0 max-w-full shrink"
                            title={tag}
                          >
                            <span className="block overflow-hidden whitespace-nowrap text-ellipsis">{tag}</span>
                          </span>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>

      {showMenu && (
        <div className="absolute bottom-3 right-3 z-40" onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="h-[24px] w-[32px] flex items-center justify-center rounded-md bg-(--cc-tag-bg) text-(--cc-tag-text) border border-(--cc-tag-overflow-border) cursor-pointer transition-colors hover:bg-(--cc-tag-overflow-hover)">
                <MoreHorizontal className="w-4 h-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              side="top"
              align="end"
              sideOffset={8}
              className="w-[128px] bg-(--cc-dropdown-bg) rounded-xl shadow-(--cc-dropdown-shadow) border border-(--cc-dropdown-border) p-1.5 flex-col gap-0.5 z-100"
            >
              <DropdownMenuItem
                onSelect={() => onEdit?.(character)}
                className="w-full py-2 px-[10px] flex items-center gap-2 rounded-lg bg-transparent border-none cursor-pointer transition-colors duration-150 hover:bg-(--cc-dropdown-item-hover) focus:bg-(--cc-dropdown-item-hover) focus:outline-none"
              >
                <Image src="/edit.svg" alt="Edit" width={16} height={16} />
                <span className="text-sm text-gray-700">编辑</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => {
                  setTimeout(() => onUnpublish?.(character), 50);
                }}
                className="w-full py-2 px-[10px] flex items-center gap-2 rounded-lg bg-transparent border-none cursor-pointer transition-colors duration-150 hover:bg-(--cc-dropdown-item-danger-hover) focus:bg-(--cc-dropdown-item-danger-hover) focus:outline-none text-red-600 focus:text-red-600 data-highlighted:text-red-600 hover:text-red-600"
              >
                <Image
                  src="/delete.svg"
                  alt="Delete"
                  width={16}
                  height={16}
                  style={{ filter: "invert(16%) sepia(96%) saturate(6932%) hue-rotate(357deg) brightness(90%) contrast(125%)" }}
                />
                <span className="text-sm">下架</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </Card>
  );
}
