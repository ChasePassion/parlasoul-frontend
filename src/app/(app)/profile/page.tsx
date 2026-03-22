"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { Loader2 } from "lucide-react";
import CharacterCard from "@/components/CharacterCard";
import CreateCharacterModal from "@/components/CreateCharacterModal";
import DeleteConfirmDialog from "@/components/DeleteConfirmDialog";
import VoiceCard from "@/components/voice/VoiceCard";
import CreateVoiceCloneModal from "@/components/voice/CreateVoiceCloneModal";
import EditVoiceModal from "@/components/voice/EditVoiceModal";
import { Button } from "@/components/ui/button";
import CreateItemCard from "@/components/CreateItemCard";
import {
    getMyCharacters,
    deleteCharacter,
    listMyVoices,
    deleteVoiceById,
    type CharacterResponse,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import WorkspaceFrame from "@/components/layout/WorkspaceFrame";
import { useSidebar } from "../layout";
import { Character } from "@/components/Sidebar";
import { mapCharacterToSidebar } from "@/lib/character-adapter";
import {
    mapVoiceProfileToCardDisplay,
    type VoiceCardDisplay,
} from "@/lib/voice-adapter";

type TabType = 'works' | 'likes' | 'voices';

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

    // Voice Modal State
    const [isCreateVoiceModalOpen, setIsCreateVoiceModalOpen] = useState(false);
    const [isEditVoiceModalOpen, setIsEditVoiceModalOpen] = useState(false);
    const [voiceToEdit, setVoiceToEdit] = useState<VoiceCardDisplay | null>(null);

    // Tab State
    const [activeTab, setActiveTab] = useState<TabType>('works');

    // Voice State
    const [voices, setVoices] = useState<VoiceCardDisplay[]>([]);
    const [voicesLoading, setVoicesLoading] = useState(false);
    const [voicesHasMore, setVoicesHasMore] = useState(false);
    const [voicesCursor, setVoicesCursor] = useState<string | null>(null);
    const [isLoadingMoreVoices, setIsLoadingMoreVoices] = useState(false);
    const [voiceToDelete, setVoiceToDelete] = useState<string | null>(null);
    const [isDeletingVoice, setIsDeletingVoice] = useState(false);

    // Clear selected character when on profile page
    useEffect(() => {
        setSelectedCharacterId(null);
    }, [setSelectedCharacterId]);

    // Load User Characters using getMyCharacters
    const loadUserCharacters = useCallback(async () => {
        if (!isAuthed) return;
        try {
            const apiCharacters = await getMyCharacters();
            const mapped: Character[] = apiCharacters.map((c: CharacterResponse) =>
                mapCharacterToSidebar(c, { creatorUsername: user?.username })
            );
            setCharacters(mapped);
        } catch (err) {
            console.error("Failed to load user characters:", err);
        }
    }, [user, isAuthed]);

    // Load Voices
    const loadVoices = useCallback(async (reset = false) => {
        if (!isAuthed) return;

        if (reset) {
            setVoicesLoading(true);
            setVoicesCursor(null);
        } else {
            setIsLoadingMoreVoices(true);
        }

        try {
            const cursor = reset ? undefined : voicesCursor;
            const response = await listMyVoices({
                cursor: cursor || undefined,
                limit: 20,
            });

            const mappedVoices = response.items.map(mapVoiceProfileToCardDisplay);

            if (reset) {
                setVoices(mappedVoices);
            } else {
                setVoices((prev) => [...prev, ...mappedVoices]);
            }

            setVoicesHasMore(response.has_more);
            setVoicesCursor(response.next_cursor);
        } catch (err) {
            console.error("Failed to load voices:", err);
        } finally {
            setVoicesLoading(false);
            setIsLoadingMoreVoices(false);
        }
    }, [isAuthed, voicesCursor]);

    useEffect(() => {
        if (user && activeTab === 'works') {
            loadUserCharacters();
        }
    }, [user, activeTab, loadUserCharacters]);

    useEffect(() => {
        if (activeTab === 'voices' && isAuthed) {
            loadVoices(true);
        }
    }, [activeTab, isAuthed, loadVoices]);

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
        if (!characterToDelete || !isAuthed) return;

        setIsDeleting(true);
        try {
            await deleteCharacter(characterToDelete.id);
            await loadUserCharacters();
            await refreshSidebarCharacters();
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
        refreshSidebarCharacters();
    };

    const handleVoiceCloneSuccess = () => {
        loadVoices(true);
    };

    const handleEditVoice = (voice: VoiceCardDisplay) => {
        setVoiceToEdit(voice);
        setIsEditVoiceModalOpen(true);
    };

    const handleDeleteVoice = (voiceId: string) => {
        setVoiceToDelete(voiceId);
    };

    const handleConfirmDeleteVoice = async () => {
        if (!voiceToDelete || !isAuthed) return;

        setIsDeletingVoice(true);
        try {
            await deleteVoiceById(voiceToDelete);
            setVoices((prev) => prev.filter((v) => v.id !== voiceToDelete));
            setVoiceToDelete(null);
        } catch (err) {
            console.error("Delete voice failed:", err);
            alert("删除音色失败，请稍后重试");
        } finally {
            setIsDeletingVoice(false);
        }
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
                        <button
                            onClick={() => setActiveTab('voices')}
                            className={`relative px-1 pb-3 text-lg font-medium transition-colors ${activeTab === 'voices' ? "text-blue-600" : "text-gray-500 hover:text-gray-700"
                                }`}
                        >
                            音色
                            {activeTab === 'voices' && (
                                <div className="absolute bottom-0 left-0 h-0.5 w-full rounded-full bg-blue-600" />
                            )}
                        </button>
                    </div>

                    {activeTab === 'works' && (
                        <div className="card-grid mb-10">
                            <CreateItemCard 
                                onClick={() => setIsCreateModalOpen(true)}
                                title="创建新角色"
                                description="创造属于你的 AI 伙伴"
                                className="h-[130px] w-full"
                            />
                            {characters.map((character) => (
                                <CharacterCard
                                    key={character.id}
                                    character={character}
                                    onClick={() => handleEdit(character)}
                                    showMenu={true}
                                    onEdit={handleEdit}
                                    onDelete={handleDeleteClick}
                                    disableHoverFloat={true}
                                />
                            ))}
                        </div>
                    )}

                    {activeTab === 'likes' && (
                        <div className="py-20 text-center text-gray-400">
                            暂无内容
                        </div>
                    )}

                    {activeTab === 'voices' && (
                        <div className="space-y-6">
                            {voicesLoading ? (
                                <div className="flex items-center justify-center py-20">
                                    <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                                </div>
                            ) : (
                                <>
                                    <div className="flex flex-wrap gap-6 mt-4">
                                        <CreateItemCard 
                                            onClick={() => setIsCreateVoiceModalOpen(true)}
                                            title="创建新音色"
                                            description="一键克隆你的专属声音"
                                            className="w-[280px] min-h-[148px]"
                                        />
                                        {voices.map((voice) => (
                                            <VoiceCard
                                                key={voice.id}
                                                voice={voice}
                                                onDelete={handleDeleteVoice}
                                                onEdit={handleEditVoice}
                                            />
                                        ))}
                                    </div>

                                    {voicesHasMore && (
                                        <div className="flex justify-center pt-4">
                                            <Button
                                                variant="outline"
                                                onClick={() => loadVoices(false)}
                                                disabled={isLoadingMoreVoices}
                                            >
                                                {isLoadingMoreVoices ? (
                                                    <>
                                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                        加载中...
                                                    </>
                                                ) : (
                                                    "加载更多"
                                                )}
                                            </Button>
                                        </div>
                                    )}
                                </>
                            )}
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

            <CreateVoiceCloneModal
                isOpen={isCreateVoiceModalOpen}
                onClose={() => setIsCreateVoiceModalOpen(false)}
                onSuccess={handleVoiceCloneSuccess}
            />

            <EditVoiceModal
                isOpen={isEditVoiceModalOpen}
                onClose={() => {
                    setIsEditVoiceModalOpen(false);
                    setVoiceToEdit(null);
                }}
                onSuccess={() => loadVoices(true)}
                voice={voiceToEdit}
            />

            <DeleteConfirmDialog
                isOpen={!!voiceToDelete}
                characterName="确定要删除这个音色吗？"
                onConfirm={handleConfirmDeleteVoice}
                onCancel={() => setVoiceToDelete(null)}
                isDeleting={isDeletingVoice}
            />
        </WorkspaceFrame>
    );
}
