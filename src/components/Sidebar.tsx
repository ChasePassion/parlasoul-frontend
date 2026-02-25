"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import type { CharacterVisibility } from "@/lib/api";
import ProfileDialog from "./ProfileDialog";

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
}

interface SidebarProps {
    characters: Character[];
    selectedCharacterId: string | null;
    onSelectCharacter: (character: Character) => void;
    onToggle: () => void;
}

// Sidebar Toggle Icon SVG Component
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
            <path d="M6.83496 3.99992C6.38353 4.00411 6.01421 4.0122 5.69824 4.03801C5.31232 4.06954 5.03904 4.12266 4.82227 4.20012L4.62207 4.28606C4.18264 4.50996 3.81498 4.85035 3.55859 5.26848L3.45605 5.45207C3.33013 5.69922 3.25006 6.01354 3.20801 6.52824C3.16533 7.05065 3.16504 7.71885 3.16504 8.66301V11.3271C3.16504 12.2712 3.16533 12.9394 3.20801 13.4618C3.25006 13.9766 3.33013 14.2909 3.45605 14.538L3.55859 14.7216C3.81498 15.1397 4.18266 15.4801 4.62207 15.704L4.82227 15.79C5.03904 15.8674 5.31234 15.9205 5.69824 15.9521C6.01398 15.9779 6.383 15.986 6.83398 15.9902L6.83496 3.99992ZM18.165 11.3271C18.165 12.2493 18.1653 12.9811 18.1172 13.5702C18.0745 14.0924 17.9916 14.5472 17.8125 14.9648L17.7295 15.1415C17.394 15.8 16.8834 16.3511 16.2568 16.7353L15.9814 16.8896C15.5157 17.1268 15.0069 17.2285 14.4102 17.2773C13.821 17.3254 13.0893 17.3251 12.167 17.3251H7.83301C6.91071 17.3251 6.17898 17.3254 5.58984 17.2773C5.06757 17.2346 4.61294 17.1508 4.19531 16.9716L4.01855 16.8896C3.36014 16.5541 2.80898 16.0434 2.4248 15.4169L2.27051 15.1415C2.03328 14.6758 1.93158 14.167 1.88281 13.5702C1.83468 12.9811 1.83496 12.2493 1.83496 11.3271V8.66301C1.83496 7.74072 1.83468 7.00898 1.88281 6.41985C1.93157 5.82309 2.03329 5.31432 2.27051 4.84856L2.4248 4.57317C2.80898 3.94666 3.36012 3.436 4.01855 3.10051L4.19531 3.0175C4.61285 2.83843 5.06771 2.75548 5.58984 2.71281C6.17898 2.66468 6.91071 2.66496 7.83301 2.66496H12.167C13.0893 2.66496 13.821 2.66468 14.4102 2.71281C15.0069 2.76157 15.5157 2.86329 15.9814 3.10051L16.2568 3.25481C16.8833 3.63898 17.394 4.19012 17.7295 4.84856L17.8125 5.02531C17.9916 5.44285 18.0745 5.89771 18.1172 6.41985C18.1653 7.00898 18.165 7.74072 18.165 8.66301V11.3271ZM8.16406 15.995H12.167C13.1112 15.995 13.7794 15.9947 14.3018 15.9521C14.8164 15.91 15.1308 15.8299 15.3779 15.704L15.5615 15.6015C15.9797 15.3451 16.32 14.9774 16.5439 14.538L16.6299 14.3378C16.7074 14.121 16.7605 13.8478 16.792 13.4618C16.8347 12.9394 16.835 12.2712 16.835 11.3271V8.66301C16.835 7.71885 16.8347 7.05065 16.792 6.52824C16.7605 6.14232 16.7073 5.86904 16.6299 5.65227L16.5439 5.45207C16.32 5.01264 15.9796 4.64498 15.5615 4.3886L15.3779 4.28606C15.1308 4.16013 14.8165 4.08006 14.3018 4.03801C13.7794 3.99533 13.1112 3.99504 12.167 3.99504H8.16406C8.16407 3.99667 8.16504 3.99829 8.16504 3.99992L8.16406 15.995Z" />
        </svg>
    );
}

export default function Sidebar({
    characters,
    selectedCharacterId,
    onSelectCharacter,
    onToggle,
}: SidebarProps) {
    const { user } = useAuth();
    const [isProfileOpen, setIsProfileOpen] = useState(false);

    // Close profile dialog when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            if (isProfileOpen && !target.closest('.profile-section')) {
                setIsProfileOpen(false);
            }
        };

        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, [isProfileOpen]);

    return (
        <aside className="w-64 h-full bg-sidebar-bg flex flex-col border-r border-divider relative">
            {/* Top Fixed Section */}
            <section className="flex-none p-4" aria-label="Sidebar actions">
                <div className="flex justify-between items-center mb-6">
                    <button
                        onClick={onToggle}
                        className="p-1 rounded-md hover:bg-sidebar-hover text-gray-500"
                        aria-label="Close Sidebar"
                    >
                        <SidebarToggleIcon className="w-5 h-5" />
                    </button>
                </div>

                {/* Discover Link */}
                <Link
                    href="/"
                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-sidebar-hover text-text-primary transition-colors"
                >
                    <div className="w-5 h-5 flex items-center justify-center">
                        <Image src="/find.svg" alt="Discover" width={20} height={20} />
                    </div>
                    <span className="font-medium">发现</span>
                </Link>
            </section>

            {/* Middle Scrollable Section - Chat History */}
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
                                <div className="relative w-10 h-10 rounded-lg overflow-hidden shrink-0">
                                    <Image
                                        src={character.avatar}
                                        alt={character.name}
                                        fill
                                        className="object-cover"
                                    />
                                </div>
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

            {/* Bottom Fixed Section - Profile */}
            <section className="flex-none p-2 mt-auto border-t border-divider relative profile-section" aria-label="账户菜单">
                <div
                    className="flex items-center gap-3 p-2 rounded-xl hover:bg-sidebar-hover cursor-pointer transition-colors"
                    onClick={(e) => {
                        e.stopPropagation();
                        setIsProfileOpen(!isProfileOpen);
                    }}
                >
                    <div className="relative w-10 h-10 rounded-lg overflow-hidden shrink-0">
                        <Image
                            src={user?.avatar_url || "/default-avatar.svg"}
                            alt={user?.username || "User"}
                            fill
                            className="object-cover rounded-[0.5rem]"
                        />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text-primary truncate">
                            {user?.username || "Guest"}
                        </p>
                    </div>
                </div>

                {/* Profile Dialog */}
                <ProfileDialog
                    isOpen={isProfileOpen}
                    onClose={() => setIsProfileOpen(false)}
                />
            </section>
        </aside>
    );
}

// Export the icon for use in page.tsx
export { SidebarToggleIcon };
