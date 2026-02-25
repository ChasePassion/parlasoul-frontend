"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import CharacterCard from "@/components/CharacterCard";
import CreateCharacterModal from "@/components/CreateCharacterModal";
import DeleteConfirmDialog from "@/components/DeleteConfirmDialog";
import {
    getUserCharacters,
    deleteCharacter,
    type CharacterResponse,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import WorkspaceFrame from "@/components/layout/WorkspaceFrame";
import { useSidebar } from "../layout";
import { Character } from "@/components/Sidebar";
import { mapCharacterToSidebar } from "@/lib/character-adapter";

export default function ProfilePage() {
    const { user, isAuthed } = useAuth();
    const { setSelectedCharacterId, refreshSidebarCharacters } = useSidebar();

    const [characters, setCharacters] = useState<Character[]>([]);

    // Modal State
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [editCharacter, setEditCharacter] = useState<Character | undefined>(undefined);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [characterToDelete, setCharacterToDelete] = useState<Character | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // Tab State
    const [activeTab, setActiveTab] = useState<'works' | 'likes'>('works');

    // Clear selected character when on profile page
    useEffect(() => {
        setSelectedCharacterId(null);
    }, [setSelectedCharacterId]);

    // Load User Characters
    const loadUserCharacters = useCallback(async () => {
        if (!user || !isAuthed) return;
        try {
            const apiCharacters = await getUserCharacters(user.id);
            const mapped: Character[] = apiCharacters.map((c: CharacterResponse) =>
                mapCharacterToSidebar(c, { creatorUsername: user.username })
            );
            setCharacters(mapped);
        } catch (err) {
            console.error("Failed to load user characters:", err);
        }
    }, [user, isAuthed]);

    useEffect(() => {
        if (user) {
            loadUserCharacters();
        }
    }, [user, loadUserCharacters]);

    // Actions
    const handleEdit = (character: Character) => {
        setEditCharacter(character);
        setIsCreateModalOpen(true);
    };

    const handleDeleteClick = (character: Character) => {
        setCharacterToDelete(character);
        setIsDeleteDialogOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (!characterToDelete || !user || !isAuthed) return;

        setIsDeleting(true);
        try {
            await deleteCharacter(characterToDelete.id);
            await loadUserCharacters(); // Refresh list
            await refreshSidebarCharacters(); // Refresh sidebar
            setIsDeleteDialogOpen(false);
            setCharacterToDelete(null);
        } catch (err) {
            console.error("Delete failed:", err);
            alert("删除失败，请稍后重试");
        } finally {
            setIsDeleting(false);
        }
    };

    const handleModalClose = () => {
        setIsCreateModalOpen(false);
        setEditCharacter(undefined);
    };

    const handleModalSuccess = () => {
        loadUserCharacters();
        refreshSidebarCharacters(); // Refresh sidebar when character created/edited
    };

    return (
        <WorkspaceFrame>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-8 pl-12">
                <div className="max-w-7xl mx-auto">
                    <div className="mb-12 ml-2 mt-4 flex items-center gap-6">
                        <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl">
                            <Image
                                src={user?.avatar_url || "/default-avatar.svg"}
                                alt={user?.username || "User"}
                                fill
                                className="object-cover"
                            />
                        </div>
                        <div>
                            <h1 className="mb-1 text-3xl font-bold text-gray-900">{user?.username}</h1>
                            <p className="text-sm text-gray-400">{user?.email || "user@example.com"}</p>
                        </div>
                    </div>

                    <div className="mb-8 flex w-[80%] gap-8 border-b border-gray-200">
                        <button
                            onClick={() => setActiveTab('works')}
                            className={`relative px-1 pb-3 text-lg font-medium transition-colors ${activeTab === 'works' ? "text-blue-600" : "text-gray-500 hover:text-gray-700"
                                }`}
                        >
                            作品
                            {activeTab === 'works' && (
                                <div className="absolute bottom-0 left-0 h-0.5 w-full rounded-full bg-blue-600" />
                            )}
                        </button>
                        <button
                            onClick={() => setActiveTab('likes')}
                            className={`relative px-1 pb-3 text-lg font-medium transition-colors ${activeTab === 'likes' ? "text-blue-600" : "text-gray-500 hover:text-gray-700"
                                }`}
                        >
                            喜欢
                            {activeTab === 'likes' && (
                                <div className="absolute bottom-0 left-0 h-0.5 w-full rounded-full bg-blue-600" />
                            )}
                        </button>
                    </div>

                    {activeTab === 'works' && (
                        <div className="mb-10 flex flex-wrap gap-6">
                            {characters.map((character) => (
                                <CharacterCard
                                    key={character.id}
                                    character={character}
                                    onClick={() => handleEdit(character)}
                                    showMenu={true}
                                    onEdit={handleEdit}
                                    onDelete={handleDeleteClick}
                                />
                            ))}
                        </div>
                    )}

                    {activeTab === 'likes' && (
                        <div className="py-20 text-center text-gray-400">
                            暂无内容
                        </div>
                    )}

                </div>
            </div>

            <CreateCharacterModal
                isOpen={isCreateModalOpen}
                onClose={handleModalClose}
                onSuccess={handleModalSuccess}
                character={editCharacter}
                mode={editCharacter ? 'edit' : 'create'}
            />

            <DeleteConfirmDialog
                isOpen={isDeleteDialogOpen}
                characterName={characterToDelete?.name || ""}
                onConfirm={handleConfirmDelete}
                onCancel={() => {
                    setIsDeleteDialogOpen(false);
                    setCharacterToDelete(null);
                }}
                isDeleting={isDeleting}
            />
        </WorkspaceFrame>
    );
}
