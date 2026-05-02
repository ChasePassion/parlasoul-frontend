"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import CharacterCard from "@/components/CharacterCard";
import CreateCharacterModal from "@/components/CreateCharacterModal";
import ConfirmActionDialog from "@/components/DeleteConfirmDialog";
import VoiceCard from "@/components/voice/VoiceCard";
import CreateVoiceCloneModal from "@/components/voice/CreateVoiceCloneModal";
import EditVoiceModal from "@/components/voice/EditVoiceModal";
import { Button } from "@/components/ui/button";
import CreateItemCard from "@/components/CreateItemCard";
import {
    unpublishCharacter,
    deleteVoiceById,
} from "@/lib/api";
import { buildShareUrl } from "@/lib/share-link";
import { useAuth } from "@/lib/auth-context";
import WorkspaceFrame from "@/components/layout/WorkspaceFrame";
import { useSidebar } from "../layout";
import { Character } from "@/components/Sidebar";
import { mapCharacterToSidebar } from "@/lib/character-adapter";
import {
    mapVoiceProfileToCardDisplay,
    type VoiceCardDisplay,
} from "@/lib/voice-adapter";
import {
    queryKeys,
    useMyCharactersQuery,
    useMyVoicesInfiniteQuery,
} from "@/lib/query";

type TabType = 'works' | 'voices';

export default function ProfilePage() {
    const { user, isAuthed, entitlements, isEntitlementsLoading } = useAuth();
    const router = useRouter();
    const queryClient = useQueryClient();
    const canUseVoiceClone = entitlements?.features.voice_clone ?? null;
    const { setSelectedCharacterId } = useSidebar();

    // Modal State
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [editCharacter, setEditCharacter] = useState<Character | undefined>(undefined);
    const [isUnpublishDialogOpen, setIsUnpublishDialogOpen] = useState(false);
    const [characterToUnpublish, setCharacterToUnpublish] = useState<Character | null>(null);
    const [isUnpublishing, setIsUnpublishing] = useState(false);

    // Voice Modal State
    const [isCreateVoiceModalOpen, setIsCreateVoiceModalOpen] = useState(false);
    const [isEditVoiceModalOpen, setIsEditVoiceModalOpen] = useState(false);
    const [voiceToEdit, setVoiceToEdit] = useState<VoiceCardDisplay | null>(null);

    // Tab State
    const [activeTab, setActiveTab] = useState<TabType>('works');
    const [voiceToDelete, setVoiceToDelete] = useState<string | null>(null);
    const charactersQuery = useMyCharactersQuery(user?.id, {
        enabled: activeTab === "works",
    });
    const voicesQuery = useMyVoicesInfiniteQuery(
        user?.id,
        { limit: 20 },
        { enabled: activeTab === "voices" },
    );
    const characters = useMemo<Character[]>(
        () =>
            (charactersQuery.data ?? []).map((c) =>
                mapCharacterToSidebar(c),
            ),
        [charactersQuery.data],
    );
    const voices = useMemo<VoiceCardDisplay[]>(
        () =>
            voicesQuery.data?.pages
                .flatMap((page) => page.items)
                .map(mapVoiceProfileToCardDisplay) ?? [],
        [voicesQuery.data],
    );
    const voicesLoading = activeTab === "voices" && voicesQuery.isLoading;
    const isLoadingMoreVoices = voicesQuery.isFetchingNextPage;

    const invalidateCharacterData = useCallback(async () => {
        await Promise.all([
            queryClient.invalidateQueries({
                queryKey: queryKeys.characters.mine(user?.id),
            }),
            queryClient.invalidateQueries({
                queryKey: queryKeys.sidebar.characters(user?.id),
            }),
        ]);
    }, [queryClient, user?.id]);

    const invalidateVoiceData = useCallback(async () => {
        await Promise.all([
            queryClient.invalidateQueries({
                queryKey: queryKeys.voices.all(user?.id),
            }),
            queryClient.invalidateQueries({
                queryKey: queryKeys.auth.entitlements(user?.id),
            }),
        ]);
    }, [queryClient, user?.id]);

    const unpublishCharacterMutation = useMutation({
        mutationFn: (characterId: string) => unpublishCharacter(characterId),
        onSuccess: invalidateCharacterData,
    });

    const deleteVoiceMutation = useMutation({
        mutationFn: (voiceId: string) => deleteVoiceById(voiceId),
        onSuccess: async () => {
            await invalidateVoiceData();
            await invalidateCharacterData();
        },
    });

    const handleCreateVoiceClick = useCallback(() => {
        if (isEntitlementsLoading) {
            return;
        }

        if (canUseVoiceClone === false) {
            router.push('/pricing');
            return;
        }

        setIsCreateVoiceModalOpen(true);
    }, [canUseVoiceClone, isEntitlementsLoading, router]);

    // Clear selected character when on profile page
    useEffect(() => {
        setSelectedCharacterId(null);
    }, [setSelectedCharacterId]);

    // Actions
    const handleEdit = (character: Character) => {
        setEditCharacter(character);
        setIsCreateModalOpen(true);
    };

    const handleUnpublishClick = (character: Character) => {
        setCharacterToUnpublish(character);
        setIsUnpublishDialogOpen(true);
    };

    const handleShare = async (character: Character) => {
        const url = buildShareUrl(character.name, character.id);
        try {
            await navigator.clipboard.writeText(url);
        } catch {
            // clipboard unavailable
        }
    };

    const handleConfirmUnpublish = async () => {
        if (!characterToUnpublish || !isAuthed) return;

        setIsUnpublishing(true);
        try {
            await unpublishCharacterMutation.mutateAsync(characterToUnpublish.id);
            setIsUnpublishDialogOpen(false);
            setCharacterToUnpublish(null);
        } catch (err) {
            console.error("Unpublish failed:", err);
            alert("下架失败，请稍后重试");
        } finally {
            setIsUnpublishing(false);
        }
    };

    const handleModalClose = () => {
        setIsCreateModalOpen(false);
        setEditCharacter(undefined);
    };

    const handleModalSuccess = () => {
        void invalidateCharacterData();
    };

    const handleVoiceCloneSuccess = () => {
        void invalidateVoiceData();
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

        try {
            await deleteVoiceMutation.mutateAsync(voiceToDelete);
            setVoiceToDelete(null);
        } catch (err) {
            console.error("Delete voice failed:", err);
            alert("删除音色失败，请稍后重试");
        }
    };

    return (
        <WorkspaceFrame>
            <div className="flex-1 overflow-y-auto custom-scrollbar pt-4 pb-8 px-8 pl-12">
                <div className="max-w-7xl mx-auto">
                    <div className="mb-6 ml-2 mt-4 flex items-center gap-6">
                        <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl">
                            <Image
                                src={user?.avatar_urls?.md || "/default-avatar.svg"}
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
                            角色
                            {activeTab === 'works' && (
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
                                    onShare={character.status === "ACTIVE" ? handleShare : undefined}
                                    onUnpublish={handleUnpublishClick}
                                />
                            ))}
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
                                            onClick={handleCreateVoiceClick}
                                            title={canUseVoiceClone === false ? "升级后创建音色" : "创建新音色"}
                                            description={
                                                isEntitlementsLoading
                                                    ? "正在校验当前套餐权益"
                                                    : canUseVoiceClone === false
                                                        ? "升级到 Plus 或 Pro 后可解锁专属音色克隆"
                                                        : "一键克隆你的专属声音"
                                            }
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

                                    {voicesQuery.hasNextPage && (
                                        <div className="flex justify-center pt-4">
                                            <Button
                                                variant="outline"
                                                onClick={() => {
                                                    void voicesQuery.fetchNextPage();
                                                }}
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

            <ConfirmActionDialog
                isOpen={isUnpublishDialogOpen}
                entityName={characterToUnpublish?.name || ""}
                entityLabel="角色"
                title="确认下架"
                description={`下架角色 "${characterToUnpublish?.name || ""}" 后，它不会再出现在公开入口，已有聊天会保留为只读历史。`}
                confirmText="确认下架"
                loadingText="下架中..."
                onConfirm={handleConfirmUnpublish}
                onCancel={() => {
                    setIsUnpublishDialogOpen(false);
                    setCharacterToUnpublish(null);
                }}
                isDeleting={isUnpublishing}
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
                onSuccess={() => {
                    void invalidateVoiceData();
                }}
                voice={voiceToEdit}
            />

            <ConfirmActionDialog
                isOpen={!!voiceToDelete}
                entityName="这个音色"
                entityLabel="音色"
                onConfirm={handleConfirmDeleteVoice}
                onCancel={() => setVoiceToDelete(null)}
                isDeleting={deleteVoiceMutation.isPending}
            />
        </WorkspaceFrame>
    );
}
