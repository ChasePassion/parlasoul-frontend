"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { CharacterResponse } from "@/lib/api-service";
import { resolveCharacterAvatarSrc } from "@/lib/character-avatar";

interface TopConsoleProps {
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  searchResults: CharacterResponse[];
  onSelectSearchResult: (character: CharacterResponse) => void;
}

export default function TopConsole({
  searchQuery,
  onSearchQueryChange,
  searchResults,
  onSelectSearchResult,
}: TopConsoleProps) {
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [activeResultIndex, setActiveResultIndex] = useState(-1);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const isDropdownOpen =
    isSearchFocused && searchQuery.trim().length > 0;

  // Reset active index when results change
  useEffect(() => {
    setActiveResultIndex(-1);
  }, [searchResults]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isDropdownOpen) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveResultIndex((prev) =>
          prev < searchResults.length - 1 ? prev + 1 : prev
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveResultIndex((prev) => (prev > 0 ? prev - 1 : 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (activeResultIndex >= 0 && activeResultIndex < searchResults.length) {
          onSelectSearchResult(searchResults[activeResultIndex]);
          setIsSearchFocused(false);
          searchInputRef.current?.blur();
        } else if (searchResults.length > 0) {
          // If none selected, enter picks the first one
          onSelectSearchResult(searchResults[0]);
          setIsSearchFocused(false);
          searchInputRef.current?.blur();
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        setIsSearchFocused(false);
        searchInputRef.current?.blur();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isDropdownOpen, searchResults, activeResultIndex, onSelectSearchResult]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target as Node)
      ) {
        setIsSearchFocused(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const syncSearchFocusState = () => {
    requestAnimationFrame(() => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(document.activeElement)
      ) {
        setIsSearchFocused(false);
      }
    });
  };

  return (
    <div className="flex items-center justify-between w-full h-[44px] mb-4 mt-2 relative z-50">
      {/* 搜索框 */}
      <div ref={searchContainerRef} className="relative w-full max-w-[320px]">
        <div
          className={`relative flex items-center h-[44px] rounded-xl border bg-white transition-[border-color,background-color,box-shadow] duration-200 ${
            isSearchFocused
              ? "border-blue-500 bg-blue-50 shadow-[0_0_0_3px_rgba(59,130,246,0.12)]"
              : "border-black/10 shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
          }`}
        >
          <div className="pl-3 pr-2 flex items-center justify-center text-black/40">
            <Image src="/search.svg" alt="Search" width={18} height={18} />
          </div>
          <Input
            ref={searchInputRef}
            className="flex-1 h-full border-0 bg-transparent shadow-none px-0 text-gray-900 placeholder:text-gray-400 focus-visible:ring-0 text-[15px]"
            placeholder="搜索角色..."
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={syncSearchFocusState}
          />
        </div>

        {/* 搜索结果下拉面板 */}
        {isDropdownOpen && (
          <div
            ref={dropdownRef}
            className="absolute top-[calc(100%+8px)] left-0 w-full bg-white rounded-xl shadow-xl border border-black/5 py-2 z-50 overflow-hidden"
          >
            {searchResults.length > 0 ? (
              <div className="max-h-[300px] overflow-y-auto scrollbar-hide">
                {searchResults.map((character, index) => (
                  <button
                    key={character.id}
                    className="flex items-center gap-3 px-3 py-2 text-left transition-colors duration-150 outline-none rounded-lg mx-2 my-0.5 w-[calc(100%-16px)] hover:bg-blue-50 focus:bg-blue-50"
                    onMouseDown={(e) => {
                      // 阻止输入框失焦
                      e.preventDefault();
                      onSelectSearchResult(character);
                      setIsSearchFocused(false);
                      searchInputRef.current?.blur();
                    }}
                    onMouseEnter={() => setActiveResultIndex(index)}
                  >
                    <Avatar className="w-8 h-8 rounded-lg shrink-0">
                      <AvatarImage
                        src={resolveCharacterAvatarSrc(character.avatar_file_name)}
                        alt={character.name}
                        className="object-cover"
                      />
                      <AvatarFallback className="text-[10px] bg-gray-100 text-gray-500 rounded-lg">
                        {character.name.slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="text-[14px] font-medium text-gray-900 truncate">
                        {character.name}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="px-4 py-6 text-center text-sm text-gray-500">
                未找到对应角色
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
