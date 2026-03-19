"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import type { CharacterVisibility } from "@/lib/api";

import { SettingsModal } from "./SettingsModal";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Menu } from "lucide-react";

export interface Character {
    id: string;
    name: string;
    description: string;
    avatar: string;
    system_prompt?: string;
    greeting_message?: string;
    tags?: string[];
    visibility?: CharacterVisibility;
    creator_id?: string;
    creator_username?: string;
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
}

export default function Sidebar({
    characters,
    selectedCharacterId,
    onSelectCharacter,
    onToggle,
}: SidebarProps) {
    const { user, logout } = useAuth();
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    return (
        <aside className="w-64 h-full bg-sidebar-bg flex flex-col border-r border-divider relative">
            <section className="flex-none p-2" aria-label="Sidebar actions">
                <div className="flex justify-between items-center mb-6">
                    <button
                        onClick={onToggle}
                        className="p-1 rounded-md hover:bg-sidebar-hover text-gray-500"
                        aria-label="Close Sidebar"
                    >
                        <Menu className="w-5 h-5" />
                    </button>
                </div>

                <Link
                    href="/"
                    className="flex items-center gap-3 py-3 px-2 rounded-xl hover:bg-sidebar-hover text-text-primary transition-colors"
                >
                    <div className="w-5 h-5 flex items-center justify-center">
                        <Image src="/find.svg" alt="Discover" width={20} height={20} />
                    </div>
                    <span className="font-medium">发现</span>
                </Link>
            </section>

            <nav className="flex-1 overflow-y-auto custom-scrollbar px-2" aria-label="角色列表">
                <div className="space-y-1">
                    {characters.map((character) => {
                        const isSelected = character.id === selectedCharacterId;
                        return (
                            <div
                                key={character.id}
                                onClick={() => onSelectCharacter(character)}
                                className={`
                                    flex items-center gap-3 p-2 rounded-xl cursor-pointer transition-colors duration-150
                                    ${isSelected ? "bg-sidebar-selected" : "hover:bg-sidebar-hover"}
                                `}
                            >
                                <Avatar className="h-10 w-10 rounded-lg overflow-hidden shrink-0">
                                    <AvatarImage src={character.avatar} alt={character.name} />
                                    <AvatarFallback className="bg-gray-100 text-gray-600 text-xs">
                                        {character.name.slice(0, 2)}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-text-primary truncate">
                                        {character.name}
                                    </p>
                                    <p className="text-xs text-gray-400 truncate">
                                        {character.description}
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </nav>

            <section className="flex-none p-1 mt-auto border-t border-divider relative" aria-label="账户菜单">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <div
                            className="flex items-center gap-3 p-1 rounded-xl hover:bg-sidebar-hover cursor-pointer transition-colors"
                        >
                            <Avatar className="h-10 w-10 rounded-lg overflow-hidden shrink-0">
                                <AvatarImage src={user?.avatar_url || "/default-avatar.svg"} alt={user?.username || "User"} />
                                <AvatarFallback className="bg-gray-100 text-gray-600 text-xs">
                                    {user?.username?.slice(0, 2) || "GU"}
                                </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-text-primary truncate">
                                    {user?.username || "Guest"}
                                </p>
                            </div>
                        </div>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                        side="top"
                        align="center"
                        className="w-[244px] p-1.5 rounded-xl shadow-xl"
                        sideOffset={10}
                    >
                        <DropdownMenuItem
                            onClick={() => {
                                window.location.href = "/profile";
                            }}
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
                            onClick={() => {
                                window.location.href = "/favorites";
                            }}
                            className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer focus:bg-accent"
                        >
                            <Image src="/mark.svg" alt="Favorites" width={20} height={20} />
                            <span className="text-sm font-medium text-gray-700">收藏夹</span>
                        </DropdownMenuItem>

                        <DropdownMenuSeparator className="bg-gray-100 h-px mx-2 my-1" />

                        <DropdownMenuItem
                            onClick={() => {
                                logout();
                                window.location.href = "/login";
                            }}
                            className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer focus:bg-accent"
                        >
                            <Image src="/out.svg" alt="Logout" width={20} height={20} />
                            <span className="text-sm font-medium text-gray-700">退出登录</span>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>

                <SettingsModal
                    open={isSettingsOpen}
                    onOpenChange={setIsSettingsOpen}
                />
            </section>
        </aside>
    );
}
