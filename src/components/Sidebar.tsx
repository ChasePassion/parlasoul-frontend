"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useGrowth } from "@/lib/growth-context";
import type { CharacterStatus, CharacterVisibility, LLMProvider } from "@/lib/api";

import { SettingsModal } from "./SettingsModal";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

export interface Character {
    id: string;
    name: string;
    description: string;
    avatar: string;
    system_prompt?: string;
    greeting_message?: string;
    tags?: string[];
    status?: CharacterStatus;
    unpublished_at?: string | null;
    visibility?: CharacterVisibility;
    creator_id?: string;
    creator_username?: string;
    llm_provider?: LLMProvider | null;
    llm_model?: string | null;
    uses_system_default_llm?: boolean;
    effective_llm_provider?: LLMProvider;
    effective_llm_model?: string;
    voice_provider?: string;
    voice_model?: string;
    voice_provider_voice_id?: string;
    voice_source_type?: "system" | "clone" | "designed" | "imported";
    voice?: {
        id: string;
        display_name: string;
        source_type: "system" | "clone" | "designed" | "imported";
        provider: string;
        provider_model: string | null;
        provider_voice_id: string;
        preview_audio_url: string | null;
        usage_hint: string | null;
    };
    distinct_user_count?: number;
}

function SidebarToggleIcon({ className = "" }: { className?: string }) {
    return (
        <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="currentColor"
            xmlns="http://www.w3.org/2000/svg"
            className={className}
        >
            <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
    );
}

export { SidebarToggleIcon };

interface SidebarProps {
    characters: Character[];
    selectedCharacterId: string | null;
    onSelectCharacter: (character: Character) => void;
    onToggle: () => void;
    isCollapsed?: boolean;
}

export default function Sidebar({
    characters,
    selectedCharacterId,
    onSelectCharacter,
    onToggle,
    isCollapsed = false,
}: SidebarProps) {
    const { user, logout } = useAuth();
    const { openEntryPopup } = useGrowth();
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const pathname = usePathname();
    const isDiscoverActive = pathname === "/";

    // ── 共用的用户菜单项，避免重复 ──
    const userMenuItems = (
        <>
            <DropdownMenuItem
                onClick={() => { window.location.href = "/profile"; }}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer focus:bg-accent"
            >
                <Image src="/me.svg" alt="Profile" width={20} height={20} />
                <span className="text-sm font-medium text-gray-700">个人资料</span>
            </DropdownMenuItem>

            <DropdownMenuItem
                onClick={() => setIsSettingsOpen(true)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer focus:bg-accent"
            >
                <Image src="/setting.svg" alt="Settings" width={20} height={20} />
                <span className="text-sm font-medium text-gray-700">设置</span>
            </DropdownMenuItem>

            <DropdownMenuItem
                onClick={() => { window.location.href = "/favorites"; }}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer focus:bg-accent"
            >
                <Image src="/mark.svg" alt="Favorites" width={20} height={20} />
                <span className="text-sm font-medium text-gray-700">收藏夹</span>
            </DropdownMenuItem>

            <DropdownMenuItem
                onClick={() => { window.location.href = "/stats"; }}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer focus:bg-accent"
            >
                <div className="flex h-[20px] w-[20px] items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-700"><line x1="18" x2="18" y1="20" y2="10"/><line x1="12" x2="12" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="14"/></svg>
                </div>
                <span className="text-sm font-medium text-gray-700">数据总览</span>
            </DropdownMenuItem>


            <DropdownMenuSeparator className="bg-gray-100 h-px mx-2 my-1" />

            <DropdownMenuItem
                onClick={async () => {
                    try {
                        await logout();
                        window.location.href = "/login";
                    } catch (error) {
                        console.error("Failed to logout:", error);
                    }
                }}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer focus:bg-accent"
            >
                <Image src="/out.svg" alt="Logout" width={20} height={20} />
                <span className="text-sm font-medium text-gray-700">退出登录</span>
            </DropdownMenuItem>
        </>
    );

    return (
        <div className="relative h-full w-full bg-sidebar-bg flex flex-col border-r border-divider overflow-x-hidden whitespace-nowrap">
            {/* 顶栏 操作区 */}
            <section className="flex-none pt-3 pb-2 flex flex-col gap-2" aria-label="Sidebar actions">
                <div className="px-2">
                    <button
                        onClick={onToggle}
                        className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-sidebar-hover text-gray-500 shrink-0 outline-none"
                        aria-label="Toggle Sidebar"
                    >
                        <Image src="/sidebar.svg" alt="Toggle Sidebar" width={16} height={16} />
                    </button>
                </div>

                <div className="px-2">
                    <Link
                        href="/"
                        className={`flex items-center w-full px-1 rounded-lg transition-all duration-300 ease-in-out overflow-hidden outline-none h-10 ${
                            isDiscoverActive ? "bg-sidebar-selected" : "hover:bg-sidebar-hover"
                        } text-text-primary`}
                    >
                        <div className="flex items-center justify-center shrink-0 w-8 h-10">
                            <Image src="/find.svg" alt="Discover" width={20} height={20} />
                        </div>
                        <span
                            className={`font-medium block min-w-[150px] transition-all duration-300 ease-in-out ${isCollapsed ? "opacity-0 ml-2" : "opacity-100 ml-3"}`}
                        >
                            发现
                        </span>
                    </Link>
                </div>

                <div className="px-2">
                    <button
                        type="button"
                        onClick={() => void openEntryPopup()}
                        className={`flex items-center w-full px-1 rounded-lg hover:bg-sidebar-hover transition-all duration-300 ease-in-out overflow-hidden outline-none h-10 text-text-primary text-left`}
                    >
                        <div className="flex items-center justify-center shrink-0 w-8 h-10">
                            <Image src="/calender.svg" alt="Check-in Calendar" width={20} height={20} />
                        </div>
                        <span
                            className={`font-medium block min-w-[150px] transition-all duration-300 ease-in-out ${isCollapsed ? "opacity-0 ml-2" : "opacity-100 ml-3"}`}
                        >
                            签到
                        </span>
                    </button>
                </div>
            </section>

            {/* 角色列表区 */}
            <nav className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar flex flex-col gap-1 w-full px-2" aria-label="角色列表">
                {characters.map((character) => {
                    const isSelected = character.id === selectedCharacterId;
                    return (
                        <button
                            key={character.id}
                            onClick={() => onSelectCharacter(character)}
                            className={`
                                flex items-center px-1 rounded-lg transition-all duration-300 ease-in-out overflow-hidden outline-none shrink-0 w-full
                                ${isSelected ? "bg-sidebar-selected" : "hover:bg-sidebar-hover"}
                                ${isCollapsed ? "h-10" : "h-[52px]"}
                            `}
                            title={isCollapsed ? character.name : undefined}
                        >
                            <div className={`flex items-center justify-center shrink-0 transition-all duration-300 ease-in-out ${isCollapsed ? 'w-8' : 'w-10'}`}>
                                <Avatar className={`rounded-lg overflow-hidden shrink-0 transition-all duration-300 ease-in-out ${isCollapsed ? 'h-8 w-8' : 'h-10 w-10'}`}>
                                    <AvatarImage src={character.avatar} alt={character.name} />
                                    <AvatarFallback className="bg-gray-100 text-gray-600 text-[10px]">
                                        {character.name.slice(0, 2)}
                                    </AvatarFallback>
                                </Avatar>
                            </div>
                            <div className={`flex flex-col items-start justify-center min-w-[150px] transition-all duration-300 ease-in-out ${isCollapsed ? "opacity-0 ml-2" : "opacity-100 ml-3"}`}>
                                <span className={`font-medium text-text-primary truncate w-full text-left transition-all duration-300 ease-in-out ${isCollapsed ? 'text-[13.5px]' : 'text-sm'}`}>
                                    {character.name}
                                </span>
                                <span className={`text-gray-400 truncate w-full text-left transition-all duration-300 ease-in-out ${isCollapsed ? 'text-[11.5px] mt-0.5' : 'text-xs mt-1'}`}>
                                    {character.description}
                                </span>
                            </div>
                        </button>
                    );
                })}
            </nav>

            {/* 用户菜单区 */}
            <section className="flex-none py-1.5 px-2 mt-auto border-t border-divider relative" aria-label="账户菜单">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button className={`flex items-center w-full px-1 rounded-lg hover:bg-sidebar-hover cursor-pointer transition-all duration-300 ease-in-out overflow-hidden outline-none relative ${isCollapsed ? 'h-10' : 'h-[52px]'}`}>
                            <div className={`flex items-center justify-center shrink-0 transition-all duration-300 ease-in-out ${isCollapsed ? 'w-8' : 'w-10'}`}>
                                <Avatar className={`rounded-lg overflow-hidden shrink-0 transition-all duration-300 ease-in-out ${isCollapsed ? 'h-8 w-8' : 'h-10 w-10'}`}>
                                    <AvatarImage src={user?.avatar_url || "/default-avatar.svg"} alt={user?.username || "User"} />
                                    <AvatarFallback className="bg-gray-100 text-gray-600 text-[10px]">
                                        {user?.username?.slice(0, 2) || "GU"}
                                    </AvatarFallback>
                                </Avatar>
                            </div>
                            <div className={`flex flex-col items-start min-w-[150px] justify-center transition-all duration-300 ease-in-out ${isCollapsed ? "opacity-0 ml-2" : "opacity-100 ml-3"}`}>
                                <span className={`font-medium text-text-primary truncate w-full text-left transition-all duration-300 ease-in-out ${isCollapsed ? 'text-[13.5px]' : 'text-sm'}`}>
                                    {user?.username || "Guest"}
                                </span>
                            </div>
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                        side={isCollapsed ? "right" : "top"}
                        align={isCollapsed ? "end" : "center"}
                        className="w-[244px] p-1.5 rounded-xl shadow-xl"
                        sideOffset={10}
                    >
                        {userMenuItems}
                    </DropdownMenuContent>
                </DropdownMenu>

                <SettingsModal
                    open={isSettingsOpen}
                    onOpenChange={setIsSettingsOpen}
                />
            </section>
        </div>
    );
}
