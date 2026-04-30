"use client";

import Image from "next/image";
import type { Character } from "./Sidebar";
import { MoreHorizontal } from "lucide-react";
import { SpriteIcon } from "@/components/ui/sprite-icon";
import { cn } from "@/lib/utils";
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
          <Image src={character.avatar} alt={character.name} fill className="object-cover" unoptimized />
        </div>

        <div className="flex-1 flex flex-col min-w-0">
          <div className="min-w-0 flex items-center gap-2 mb-0.5">
            <h3 className="text-base font-bold text-white m-0 whitespace-nowrap overflow-hidden text-ellipsis drop-shadow-(--cc-text-shadow) tracking-wide">
              {character.name}
            </h3>
            {isUnpublished ? (
              <span className="shrink-0 rounded-md bg-amber-100/90 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-amber-700">
                已下架
              </span>
            ) : null}
          </div>

          <p className="min-h-3.5 text-[11px] text-white/50 m-0 mb-1 whitespace-nowrap overflow-hidden text-ellipsis drop-shadow-(--cc-text-shadow-light)">
            {character.creator_username ? `作者：${character.creator_username}` : null}
          </p>

          <p className="text-xs text-(--cc-text-muted) leading-5 m-0 line-clamp-2 drop-shadow-(--cc-text-shadow-light)">
            {character.description}
          </p>

          <div className="mt-auto flex items-center gap-1">
            <SpriteIcon name="chat-bubble" size={14} className="text-(--cc-text-secondary)" />
            <span className="text-[13px] font-medium leading-none text-(--cc-text-secondary)">
              {character.distinct_user_count != null
                ? character.distinct_user_count >= 1000
                  ? `${(character.distinct_user_count / 1000).toFixed(1)}k`
                  : String(character.distinct_user_count)
                : '-'}
            </span>
          </div>
        </div>
      </CardContent>

      {showMenu && (
        <div className="absolute bottom-3 right-3 z-40" onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="h-[24px] w-[32px] flex items-center justify-center rounded-md bg-(--cc-card-menu-trigger-bg) text-(--cc-card-menu-trigger-text) border border-(--cc-card-menu-trigger-border) cursor-pointer transition-colors hover:bg-(--cc-card-menu-trigger-hover-bg)">
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
                <SpriteIcon name="edit" size={16} />
                <span className="text-sm text-gray-700">编辑</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => {
                  setTimeout(() => onUnpublish?.(character), 50);
                }}
                className="w-full py-2 px-[10px] flex items-center gap-2 rounded-lg bg-transparent border-none cursor-pointer transition-colors duration-150 hover:bg-(--cc-dropdown-item-danger-hover) focus:bg-(--cc-dropdown-item-danger-hover) focus:outline-none text-red-600 focus:text-red-600 data-highlighted:text-red-600 hover:text-red-600"
              >
                <SpriteIcon name="delete" size={16} className="text-red-600" />
                <span className="text-sm">下架</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </Card>
  );
}
