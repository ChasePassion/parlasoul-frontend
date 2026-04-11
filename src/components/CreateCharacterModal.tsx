"use client";

import { useState, useRef, ChangeEvent, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import {
    createCharacter,
    getMyCharacters,
    getVoiceById,
    patchVoiceById,
    updateCharacter,
    uploadFile,
    CharacterResponse,
    CreateCharacterRequest,
    UpdateCharacterRequest,
    CharacterVisibility,
    VoiceSelectableItem,
    LLMProvider,
} from "@/lib/api";
import AvatarCropper from "./AvatarCropper";
import VoiceSelector from "./voice/VoiceSelector";
import VoiceUsageManagerDialog from "./voice/VoiceUsageManagerDialog";
import ModelSelector from "./ModelSelector";
import { getErrorMessage } from "@/lib/error-map";
import { logger, Module, CharacterEvent } from "@/lib/logger";
import type { Character } from "./Sidebar";
import {
    CHARACTER_TAG_LIMIT,
    CHARACTER_TAG_MAX_LENGTH,
    hasCharacterTag,
    normalizeCharacterTag,
} from "@/lib/character-tags";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { X, Plus, Loader2, Users } from "lucide-react";

interface CreateCharacterModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    character?: Character;
    mode?: 'create' | 'edit';
}

const TAG_COLORS = [
    { name: "blue", bg: "bg-blue-50", text: "text-blue-600", border: "border-blue-200" },
    { name: "pink", bg: "bg-pink-50", text: "text-pink-600", border: "border-pink-200" },
    { name: "purple", bg: "bg-purple-50", text: "text-purple-600", border: "border-purple-200" },
    { name: "cyan", bg: "bg-cyan-50", text: "text-cyan-600", border: "border-cyan-200" },
    { name: "amber", bg: "bg-amber-50", text: "text-amber-600", border: "border-amber-200" },
    { name: "green", bg: "bg-green-50", text: "text-green-600", border: "border-green-200" },
];

const DEFAULT_SYSTEM_VOICE_MODEL = "qwen3-tts-instruct-flash-realtime";

function resolveVoiceModel(voice: VoiceSelectableItem): string | null {
    if (voice.provider_model) {
        return voice.provider_model;
    }

    if (voice.source_type === "system" && voice.id.startsWith("sys:")) {
        const parts = voice.id.split(":", 4);
        if (parts.length >= 4 && parts[2]) {
            return parts[2];
        }
        return DEFAULT_SYSTEM_VOICE_MODEL;
    }

    return null;
}

function isManageableLocalVoice(voice: VoiceSelectableItem | null): voice is VoiceSelectableItem {
    if (!voice || voice.source_type !== "clone") {
        return false;
    }

    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(voice.id);
}

export default function CreateCharacterModal({
    isOpen,
    onClose,
    onSuccess,
    character,
    mode = 'create'
}: CreateCharacterModalProps) {
    const { isAuthed } = useAuth();
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [greetingMessage, setGreetingMessage] = useState("");
    const [systemPrompt, setSystemPrompt] = useState("");
    const [tagInput, setTagInput] = useState("");
    const [selectedTags, setSelectedTags] = useState<{ label: string; color: typeof TAG_COLORS[0] }[]>([]);
    const [visibility, setVisibility] = useState<CharacterVisibility>("PUBLIC");
    const [avatarFileName, setAvatarFileName] = useState<string | null>(null);
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedVoice, setSelectedVoice] = useState<VoiceSelectableItem | null>(null);
    const [selectedLLMProvider, setSelectedLLMProvider] = useState<LLMProvider | null | undefined>(undefined);
    const [selectedLLMModel, setSelectedLLMModel] = useState<string | null | undefined>(undefined);
    const [isVoiceUsageDialogOpen, setIsVoiceUsageDialogOpen] = useState(false);
    const [voiceUsageCharacters, setVoiceUsageCharacters] = useState<CharacterResponse[]>([]);
    const [voiceUsageCharacterIds, setVoiceUsageCharacterIds] = useState<string[]>([]);
    const [voiceUsageVoiceId, setVoiceUsageVoiceId] = useState<string | null>(null);
    const [isVoiceUsageLoading, setIsVoiceUsageLoading] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const manageableVoiceId = isManageableLocalVoice(selectedVoice) ? selectedVoice.id : null;

    useEffect(() => {
        if (isOpen && mode === 'edit' && character) {
            let fallbackVoice: VoiceSelectableItem | null = null;

            if (character.voice) {
                fallbackVoice = character.voice;
            } else if (character.voice_provider && character.voice_model && character.voice_provider_voice_id && character.voice_source_type) {
                fallbackVoice = {
                    id:
                        character.voice_source_type === "system"
                            ? `sys:${character.voice_provider}:${character.voice_model}:${character.voice_provider_voice_id}`
                            : `clone:${character.voice_provider}:${character.voice_provider_voice_id}`,
                    display_name: character.voice_provider_voice_id,
                    source_type: character.voice_source_type,
                    provider: character.voice_provider,
                    provider_model: character.voice_model,
                    provider_voice_id: character.voice_provider_voice_id,
                    avatar_file_name: null,
                    preview_audio_url: null,
                    usage_hint: null,
                };
            }

            setName(character.name);
            setDescription(character.description);
            setGreetingMessage(character.greeting_message || "");
            setSystemPrompt(character.system_prompt || "");
            if (character.visibility) {
                setVisibility(character.visibility);
            } else {
                setVisibility("PUBLIC");
            }
            setAvatarFileName(character.avatar);
            setAvatarPreview(character.avatar);
            setSelectedVoice(fallbackVoice);
            setSelectedLLMProvider(character.llm_provider ?? null);
            setSelectedLLMModel(character.llm_model ?? null);
            setIsVoiceUsageDialogOpen(false);
            setVoiceUsageCharacters([]);
            setVoiceUsageCharacterIds([]);
            setVoiceUsageVoiceId(null);
            setTagInput("");
            setError(null);

            if (character.tags && character.tags.length > 0) {
                const mappedTags = character.tags.map((tag, index) => ({
                    label: normalizeCharacterTag(tag),
                    color: TAG_COLORS[index % TAG_COLORS.length]
                }));
                setSelectedTags(mappedTags);
            } else {
                setSelectedTags([]);
            }
        } else if (isOpen && mode === 'create') {
            setName("");
            setDescription("");
            setGreetingMessage("");
            setSystemPrompt("");
            setTagInput("");
            setSelectedTags([]);
            setVisibility("PUBLIC");
            setAvatarFileName(null);
            setAvatarPreview(null);
            setSelectedVoice(null);
            setSelectedLLMProvider(undefined);
            setSelectedLLMModel(undefined);
            setIsVoiceUsageDialogOpen(false);
            setVoiceUsageCharacters([]);
            setVoiceUsageCharacterIds([]);
            setVoiceUsageVoiceId(null);
            setError(null);
        }
    }, [isOpen, mode, character]);

    useEffect(() => {
        if (!manageableVoiceId) {
            setIsVoiceUsageDialogOpen(false);
            setVoiceUsageCharacterIds([]);
            setVoiceUsageVoiceId(null);
            return;
        }

        if (voiceUsageVoiceId && voiceUsageVoiceId !== manageableVoiceId) {
            setVoiceUsageCharacterIds([]);
            setVoiceUsageVoiceId(null);
        }
    }, [manageableVoiceId, voiceUsageVoiceId]);

    const handleAvatarClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }

        setSelectedFile(file);
    };

    const handleCropConfirm = async (croppedBlob: Blob) => {
        setSelectedFile(null);
        setIsUploading(true);
        setError(null);

        try {
            if (!isAuthed) throw new Error("请先登录");

            const file = new File([croppedBlob], "avatar.jpg", { type: "image/jpeg" });
            const previewUrl = URL.createObjectURL(croppedBlob);
            setAvatarPreview(previewUrl);

            const result = await uploadFile(file);
            setAvatarFileName(result.url);
        } catch (err) {
            setError(getErrorMessage(err));
            setAvatarPreview(null);
        } finally {
            setIsUploading(false);
        }
    };

    const handleCropCancel = () => {
        setSelectedFile(null);
    };

    const handleOpenVoiceUsageDialog = async () => {
        if (!manageableVoiceId) {
            return;
        }

        setIsVoiceUsageLoading(true);
        setError(null);

        try {
            const [voiceDetail, characters] = await Promise.all([
                getVoiceById(manageableVoiceId),
                getMyCharacters(),
            ]);
            const nextCharacterIds = (voiceDetail.bound_character_ids ?? []).filter(
                (characterId) => characterId !== character?.id,
            );
            setVoiceUsageCharacters(characters);
            setVoiceUsageCharacterIds(nextCharacterIds);
            setVoiceUsageVoiceId(manageableVoiceId);
            setIsVoiceUsageDialogOpen(true);
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setIsVoiceUsageLoading(false);
        }
    };

    const handleAddTag = () => {
        const normalizedTag = normalizeCharacterTag(tagInput);
        const selectedLabels = selectedTags.map((tag) => tag.label);

        if (!normalizedTag) {
            setError("标签输入不能为空");
            return;
        }

        if (normalizedTag.length > CHARACTER_TAG_MAX_LENGTH) {
            setError(`标签长度必须在 1-${CHARACTER_TAG_MAX_LENGTH} 个字符之间`);
            return;
        }

        if (selectedTags.length >= CHARACTER_TAG_LIMIT) {
            setError(`最多只能设置 ${CHARACTER_TAG_LIMIT} 个标签`);
            return;
        }

        if (hasCharacterTag(selectedLabels, normalizedTag)) {
            setError("此标签已经添加过了");
            return;
        }

        const colorIndex = selectedTags.length % TAG_COLORS.length;
        setSelectedTags(prev => [...prev, { label: normalizedTag, color: TAG_COLORS[colorIndex] }]);
        setTagInput("");
        setError(null);
    };

    const handleRemoveTag = (tagLabel: string) => {
        setSelectedTags(prev => prev.filter(tag => tag.label !== tagLabel));
    };

    const handleTagInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            e.preventDefault();
            handleAddTag();
        }
    };

    const handleSubmit = async () => {
        if (!name.trim()) {
            setError("请填写角色名称");
            return;
        }
        if (!description.trim()) {
            setError("请填写角色描述");
            return;
        }
        if (description.trim().length > 35) {
            setError("角色描述需限制在 35 字以内");
            return;
        }
        if (!systemPrompt.trim()) {
            setError("请填写系统提示词");
            return;
        }
        if (!selectedVoice) {
            setError("请选择角色音色");
            return;
        }
        setIsSubmitting(true);
        setError(null);

        const startTime = Date.now();
        logger.info(Module.CHARACTER, CharacterEvent.STARTED, `Character ${mode} started`, {
          mode,
          name: name.trim(),
        });

        try {
            if (!isAuthed) throw new Error("请先登录");
            let voiceProvider = selectedVoice.provider;
            let voiceModel = resolveVoiceModel(selectedVoice);
            let voiceProviderVoiceId = selectedVoice.provider_voice_id;
            let voiceSourceType = selectedVoice.source_type;
            let manageableSelectedVoiceId: string | null = manageableVoiceId;

            if (selectedVoice.source_type === "clone") {
                const voiceProfile = await getVoiceById(selectedVoice.id);
                voiceProvider = voiceProfile.provider;
                voiceModel = voiceProfile.provider_model;
                voiceProviderVoiceId = voiceProfile.provider_voice_id;
                voiceSourceType = voiceProfile.source_type;
                manageableSelectedVoiceId = voiceProfile.id;
            }

            if (!voiceModel) {
                throw new Error("所选音色缺少模型信息，请重新选择");
            }

            logger.info(Module.CHARACTER, CharacterEvent.VOICE_RESOLVED, "Voice profile resolved", {
              voice_provider: voiceProvider,
              voice_source_type: voiceSourceType,
            });

            const baseData = {
                name: name.trim(),
                description: description.trim(),
                system_prompt: systemPrompt.trim(),
                greeting_message: greetingMessage.trim() || undefined,
                avatar_file_name: avatarFileName || undefined,
                tags: selectedTags.length > 0 ? selectedTags.map(tag => tag.label) : undefined,
                visibility: visibility,
                voice_provider: voiceProvider,
                voice_model: voiceModel,
                voice_provider_voice_id: voiceProviderVoiceId,
                voice_source_type: voiceSourceType,
                llm_provider: selectedLLMProvider,
                llm_model: selectedLLMModel,
            };

            let savedCharacter: CharacterResponse;
            logger.info(Module.CHARACTER, CharacterEvent.API_CALLED, `Calling ${mode === "edit" ? "updateCharacter" : "createCharacter"} API`, {
              llm_provider: selectedLLMProvider,
              llm_model: selectedLLMModel,
            });

            if (mode === 'edit' && character) {
                const updateData: UpdateCharacterRequest = baseData;
                savedCharacter = await updateCharacter(character.id, updateData);
            } else {
                const createData: CreateCharacterRequest = baseData;
                savedCharacter = await createCharacter(createData);
            }

            if (
                manageableSelectedVoiceId &&
                voiceUsageVoiceId === manageableSelectedVoiceId
            ) {
                const mergedCharacterIds = Array.from(
                    new Set([...voiceUsageCharacterIds, savedCharacter.id]),
                );
                await patchVoiceById(manageableSelectedVoiceId, {
                    character_ids: mergedCharacterIds,
                });
            }

            if (mode === 'create') {
                setName("");
                setDescription("");
                setGreetingMessage("");
                setSystemPrompt("");
                setSelectedTags([]);
                setVisibility("PUBLIC");
                setAvatarFileName(null);
                setAvatarPreview(null);
                setSelectedVoice(null);
                setSelectedLLMProvider(undefined);
                setSelectedLLMModel(undefined);
                setVoiceUsageCharacters([]);
                setVoiceUsageCharacterIds([]);
                setVoiceUsageVoiceId(null);
            }

            logger.info(Module.CHARACTER, CharacterEvent.COMPLETED, `Character ${mode} completed`, {
              character_id: savedCharacter.id,
              elapsed_ms: Date.now() - startTime,
            });

            onSuccess();
            onClose();
        } catch (err) {
            logger.fromError(Module.CHARACTER, err, CharacterEvent.FAILED, {
              mode,
              elapsed_ms: Date.now() - startTime,
            });
            setError(getErrorMessage(err));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleClose = () => {
        if (!isSubmitting) {
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="max-w-lg rounded-2xl p-0 overflow-hidden bg-white border-none shadow-2xl max-h-[90vh] flex flex-col">
                <DialogHeader className="flex-none flex items-center justify-between p-5 border-b border-gray-100 bg-white z-10">
                    <DialogTitle className="text-xl font-bold text-gray-900">
                        {mode === 'edit' ? "编辑角色" : "创建新角色"}
                    </DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto min-h-0 p-5 space-y-5 custom-scrollbar">
                    {error && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                            {error}
                        </div>
                    )}

                    <div className="flex flex-col items-center">
                        <div
                            onClick={handleAvatarClick}
                            className="relative w-24 h-24 rounded-lg bg-gray-100 border-2 border-dashed border-gray-300 cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all overflow-hidden"
                        >
                            {avatarPreview ? (
                                <Avatar className="w-full h-full rounded-lg">
                                    <AvatarImage src={avatarPreview} alt="Avatar preview" />
                                    <AvatarFallback className="bg-gray-100 text-gray-400">
                                        <Loader2 className={`w-6 h-6 ${isUploading ? "animate-spin" : ""}`} />
                                    </AvatarFallback>
                                </Avatar>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full text-gray-400">
                                    <Plus className="w-8 h-8" />
                                    <span className="text-xs mt-1">上传头像</span>
                                </div>
                            )}
                            {isUploading && (
                                <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                                    <Loader2 className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                                </div>
                            )}
                        </div>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/jpeg,image/png,image/gif,image/webp"
                            onChange={handleFileChange}
                            className="hidden"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="name" className="text-sm font-medium text-gray-700">
                            角色名称 <span className="text-red-500">*</span>
                        </Label>
                        <Input
                            id="name"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="给角色起个名字"
                            maxLength={20}
                            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus-visible:outline-none focus-visible:ring-0 focus-visible:border-gray-200! [&::selection]:bg-blue-500 [&::selection]:text-white"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="description" className="text-sm font-medium text-gray-700">
                            角色描述 <span className="text-red-500">*</span>
                        </Label>
                        <Input
                            id="description"
                            type="text"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="简短描述角色特点（最多35个字符）"
                            maxLength={35}
                            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus-visible:outline-none focus-visible:ring-0 focus-visible:border-gray-200! [&::selection]:bg-blue-500 [&::selection]:text-white"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            {description.length}/35 字符，将显示在角色卡片上
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="greeting" className="text-sm font-medium text-gray-700">
                            开场问候语
                        </Label>
                        <Input
                            id="greeting"
                            type="text"
                            value={greetingMessage}
                            onChange={(e) => setGreetingMessage(e.target.value)}
                            placeholder="角色的第一句话（选填）"
                            maxLength={200}
                            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus-visible:outline-none focus-visible:ring-0 focus-visible:border-gray-200! [&::selection]:bg-blue-500 [&::selection]:text-white"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            聊天时角色主动发送的第一条消息
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="systemPrompt" className="text-sm font-medium text-gray-700">
                            系统提示词 <span className="text-red-500">*</span>
                        </Label>
                        <textarea
                            id="systemPrompt"
                            value={systemPrompt}
                            onChange={(e) => setSystemPrompt(e.target.value)}
                            placeholder="定义角色的性格、背景和行为方式..."
                            rows={4}
                            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus-visible:outline-none focus-visible:ring-0 focus-visible:border-gray-200! transition-all resize-none [&::selection]:bg-blue-500 [&::selection]:text-white"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label className="text-sm font-medium text-gray-700">
                            添加标签（最多{CHARACTER_TAG_LIMIT}个）
                        </Label>

                        <div className="flex gap-2">
                            <div className="flex-1 relative">
                                <Input
                                    type="text"
                                    value={tagInput}
                                    onChange={(e) => setTagInput(e.target.value)}
                                    onKeyDown={handleTagInputKeyDown}
                                    placeholder="输入标签名称..."
                                    maxLength={CHARACTER_TAG_MAX_LENGTH}
                                    disabled={selectedTags.length >= CHARACTER_TAG_LIMIT}
                                    className="w-full px-4 py-2.5 pr-12 border border-gray-200 rounded-lg focus-visible:outline-none focus-visible:ring-0 focus-visible:border-gray-200! transition-all disabled:bg-gray-100 disabled:cursor-not-allowed [&::selection]:bg-blue-500 [&::selection]:text-white"
                                />
                                <button
                                    type="button"
                                    onClick={handleAddTag}
                                    disabled={selectedTags.length >= CHARACTER_TAG_LIMIT || !tagInput.trim()}
                                    className="absolute right-[2px] top-1/2 -translate-y-1/2 w-9 h-9 rounded-lg bg-transparent hover:bg-gray-100 hover:text-gray-600 disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center"
                                >
                                    <Plus className="w-5 h-5 text-gray-700" />
                                </button>
                            </div>
                        </div>

                        <p className="text-xs text-gray-500 mt-1">
                            最长 {CHARACTER_TAG_MAX_LENGTH} 个字符。角色卡片里会自动截断过长标签，并把剩余标签折叠为 +N。
                        </p>

                        {selectedTags.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                                {selectedTags.map((tag, index) => (
                                    <Badge
                                        key={index}
                                        variant="outline"
                                        className={`${tag.color.bg} ${tag.color.text} ${tag.color.border} px-3 py-1.5 text-sm font-medium rounded-lg flex items-center gap-1.5 border`}
                                    >
                                        <span>#{tag.label}</span>
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveTag(tag.label)}
                                            className="hover:opacity-70 transition-opacity"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    </Badge>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="py-2 space-y-2">
                        <Label className="text-sm font-medium text-gray-700 block mb-2">可见性</Label>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => setVisibility("PUBLIC")}
                                className={`flex-1 px-3 py-2 text-sm rounded-lg border transition-colors ${visibility === "PUBLIC"
                                    ? "bg-blue-600 text-white border-blue-600"
                                    : "bg-white text-gray-700 border-gray-200 hover:border-blue-300"
                                    }`}
                            >
                                公开
                            </button>
                            <button
                                type="button"
                                onClick={() => setVisibility("UNLISTED")}
                                className={`flex-1 px-3 py-2 text-sm rounded-lg border transition-colors ${visibility === "UNLISTED"
                                    ? "bg-blue-600 text-white border-blue-600"
                                    : "bg-white text-gray-700 border-gray-200 hover:border-blue-300"
                                    }`}
                            >
                                链接可见
                            </button>
                            <button
                                type="button"
                                onClick={() => setVisibility("PRIVATE")}
                                className={`flex-1 px-3 py-2 text-sm rounded-lg border transition-colors ${visibility === "PRIVATE"
                                    ? "bg-blue-600 text-white border-blue-600"
                                    : "bg-white text-gray-700 border-gray-200 hover:border-blue-300"
                                    }`}
                            >
                                私有
                            </button>
                        </div>
                        <p className="text-xs text-gray-500 mt-1.5">
                            {visibility === "PUBLIC" && "将显示在市场中，任何人可访问"}
                            {visibility === "UNLISTED" && "不在市场中显示，但可通过链接访问"}
                            {visibility === "PRIVATE" && "仅自己可见，用于编辑草稿"}
                        </p>
                    </div>

                    <div className="py-2 space-y-3">
                        <div className="flex items-center justify-between">
                            <Label className="text-sm font-medium text-gray-700">模型选择</Label>
                        </div>
                        <ModelSelector
                            selectedProvider={selectedLLMProvider}
                            selectedModel={selectedLLMModel}
                            onSelectModel={(provider, model) => {
                                setSelectedLLMProvider(provider);
                                setSelectedLLMModel(model);
                            }}
                            onSelectSystemDefault={() => {
                                setSelectedLLMProvider(null);
                                setSelectedLLMModel(null);
                            }}
                            disabled={isSubmitting}
                        />
                        <p className="text-xs text-gray-500">
                            选择角色使用的AI模型，默认使用系统配置
                        </p>
                    </div>

                    <div className="py-2 space-y-3">
                        <div className="flex items-center justify-between">
                            <Label className="text-sm font-medium text-gray-700">音色选择</Label>
                            {!selectedVoice && (
                                <span className="text-xs text-red-500">必选</span>
                            )}
                        </div>
                        <VoiceSelector
                            selectedVoiceId={selectedVoice?.id || null}
                            onSelectVoice={setSelectedVoice}
                            disabled={isSubmitting}
                        />
                        {manageableVoiceId && (
                            <div className="rounded-xl border border-gray-200 bg-gray-50/70 p-4">
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <p className="text-sm font-medium text-gray-700">
                                            管理使用该音色的角色
                                        </p>
                                        <p className="mt-1 text-xs text-gray-500">
                                            在角色保存时同步更新其他使用该音色的角色。
                                        </p>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={handleOpenVoiceUsageDialog}
                                        disabled={isSubmitting || isVoiceUsageLoading}
                                        className="rounded-lg border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                                    >
                                        {isVoiceUsageLoading ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <Users data-icon="inline-start" />
                                        )}
                                        管理角色
                                    </Button>
                                </div>
                                <p className="mt-3 text-xs text-gray-500">
                                    {mode === 'edit'
                                        ? `当前角色 ${character?.name ?? ""} 会在保存后自动使用这个音色，勾选列表只管理其他角色。`
                                        : "新角色会在创建后自动使用这个音色，勾选列表只管理其他已存在角色。"}
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                <DialogFooter className="flex-none flex gap-3 p-5 border-t border-gray-100 bg-white z-10">
                    <Button
                        variant="outline"
                        onClick={handleClose}
                        disabled={isSubmitting}
                        className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
                    >
                        取消
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={isSubmitting || isUploading}
                        className="flex-1 px-4 py-2.5 bg-[#3964FE] text-white rounded-lg font-medium hover:bg-[#2a4fd6] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                {mode === 'edit' ? '更新中...' : '创建中...'}
                            </>
                        ) : (
                            mode === 'edit' ? '更新角色' : '创建角色'
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>

            {selectedFile && (
                <AvatarCropper
                    file={selectedFile}
                    onConfirm={handleCropConfirm}
                    onCancel={handleCropCancel}
                />
            )}

            <VoiceUsageManagerDialog
                isOpen={isVoiceUsageDialogOpen}
                onClose={() => setIsVoiceUsageDialogOpen(false)}
                onSave={(characterIds) => {
                    setVoiceUsageCharacterIds(characterIds);
                    setIsVoiceUsageDialogOpen(false);
                }}
                characters={voiceUsageCharacters}
                selectedCharacterIds={voiceUsageCharacterIds}
                voiceName={selectedVoice?.display_name || "当前音色"}
                excludeCharacterId={mode === 'edit' && character ? character.id : undefined}
                isLoading={isVoiceUsageLoading}
                helperText={
                    mode === 'edit'
                        ? `当前角色 ${character?.name ?? ""} 会在保存后自动使用该音色。`
                        : "当前新角色会在创建后自动使用该音色。"
                }
            />
        </Dialog>
    );
}
