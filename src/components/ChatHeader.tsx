"use client";

import { Sparkles } from "lucide-react";
import type { Character } from "./Sidebar";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import ReadingRing from "@/components/growth/ReadingRing";
import { SpriteIcon } from "@/components/ui/sprite-icon";

interface ChatHeaderProps {
    character?: Character | null;
    chatId?: string;
    onNewChat?: () => void;
    onToggleAssistant?: () => void;
    isAssistantOpen?: boolean;
    onToggleHistory?: () => void;
    isHistoryOpen?: boolean;
    isNewChatDisabled?: boolean;
    isReadOnly?: boolean;
    onToggleSidebar?: () => void;
}

export default function ChatHeader({
    character,
    chatId,
    onNewChat,
    onToggleAssistant,
    isAssistantOpen = false,
    onToggleHistory,
    isHistoryOpen = false,
    isNewChatDisabled = false,
    isReadOnly = false,
    onToggleSidebar,
}: ChatHeaderProps) {
    if (!character) {
        return (
            <div
                className="w-full h-[64px] border-b border-divider flex items-center"
                style={{ backgroundColor: "var(--workspace-bg)" }}
            />
        );
    }

    return (
        <div
            className="w-full h-[64px] flex items-center justify-between gap-3 px-[14px] py-[14px] border-b border-divider"
            style={{ backgroundColor: "var(--workspace-bg)" }}
        >
            <div className="flex items-center gap-3 min-w-0">
                {onToggleSidebar && (
                    <button
                        type="button"
                        onClick={onToggleSidebar}
                        className="md:hidden h-9 w-9 flex items-center justify-center rounded-lg hover:bg-sidebar-hover text-black shrink-0"
                        aria-label="打开侧边栏"
                    >
                        <SpriteIcon name="sidebar" size={16} />
                    </button>
                )}
                <Avatar className="h-10 w-10 rounded-lg overflow-hidden shrink-0">
                    <AvatarImage src={character.avatar} alt={character.name} />
                    <AvatarFallback className="bg-gray-100 text-gray-600">
                        {character.name.slice(0, 2)}
                    </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex items-center gap-2">
                    <span className="text-base font-[500] text-text-primary truncate">
                        {character.name}
                    </span>
                    {isReadOnly ? (
                        <span className="shrink-0 rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                            已下架
                        </span>
                    ) : null}
                </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
                {chatId && <ReadingRing chatId={chatId} />}
                <button
                    type="button"
                    onClick={onToggleAssistant}
                    className={`h-9 w-9 flex items-center justify-center rounded-lg border transition-colors ${
                        isAssistantOpen
                            ? "border-[#3964FE]/20 bg-[#3964FE]/10 text-[#3964FE]"
                            : "border-divider bg-white text-gray-600 hover:bg-sidebar-hover"
                    }`}
                    aria-label="学习助手"
                >
                    <Sparkles className="h-[17px] w-[17px]" />
                </button>
                <button
                    type="button"
                    onClick={onNewChat}
                    disabled={isNewChatDisabled}
                    className="h-9 w-9 flex items-center justify-center rounded-lg border border-divider bg-white hover:bg-sidebar-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    aria-label="新建聊天"
                >
                    <SpriteIcon name="edit-square" size={18} />
                </button>
                <button
                    type="button"
                    onClick={onToggleHistory}
                    className={`h-9 w-9 flex items-center justify-center rounded-lg border transition-colors ${
                        isHistoryOpen
                            ? "border-[#3964FE]/20 bg-[#3964FE]/10"
                            : "border-divider bg-white hover:bg-sidebar-hover"
                    }`}
                    aria-label="历史记录"
                >
                    <SpriteIcon name="history" size={18} />
                </button>
            </div>
        </div>
    );
}
