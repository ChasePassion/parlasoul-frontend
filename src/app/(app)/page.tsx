"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import CharacterCard from "@/components/CharacterCard";
import { useAuth } from "@/lib/auth-context";
import WorkspaceFrame from "@/components/layout/WorkspaceFrame";
import { useSidebar } from "./layout";
import { Character } from "@/components/Sidebar";
import { getOrCreateChatId } from "@/lib/chat-helpers";

export default function DiscoverPage() {
    const { user } = useAuth();
    const router = useRouter();
    const {
        setSelectedCharacterId,
        refreshSidebarCharacters,
        sidebarCharacters,
    } = useSidebar();

    // Clear selected character when on discover page
    useEffect(() => {
        setSelectedCharacterId(null);
    }, [setSelectedCharacterId]);

    const characters = useMemo(
        () =>
            sidebarCharacters.map((character) => ({
                ...character,
                creator_username:
                    character.creator_id === user?.id ? user?.username : "Creator",
            })),
        [sidebarCharacters, user?.id, user?.username]
    );

    useEffect(() => {
        if (user && sidebarCharacters.length === 0) {
            refreshSidebarCharacters();
        }
    }, [user, sidebarCharacters.length, refreshSidebarCharacters]);

    const handleSelectCharacter = async (character: Character) => {
        try {
            const chatId = await getOrCreateChatId(character.id);
            router.push(`/chat/${chatId}`);
        } catch (err) {
            console.error("Failed to open chat:", err);
        }
    };

    return (
        <WorkspaceFrame>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
                <div className="max-w-7xl mx-auto pl-8">
                    <div className="card-grid mt-8">
                        {characters.map((character) => (
                            <CharacterCard
                                key={character.id}
                                character={character}
                                onClick={handleSelectCharacter}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </WorkspaceFrame>
    );
}
