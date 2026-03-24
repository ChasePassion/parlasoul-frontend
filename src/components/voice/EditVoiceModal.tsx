"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Loader2, Users } from "lucide-react";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getMyCharacters, getVoiceById, patchVoiceById, type CharacterResponse } from "@/lib/api";
import { getErrorMessage } from "@/lib/error-map";
import type { VoiceCardDisplay } from "@/lib/voice-adapter";
import VoiceAvatarField from "./VoiceAvatarField";
import VoiceUsageManagerDialog from "./VoiceUsageManagerDialog";

interface EditVoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  voice: VoiceCardDisplay | null;
}

export default function EditVoiceModal({
  isOpen,
  onClose,
  onSuccess,
  voice,
}: EditVoiceModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [avatarFileName, setAvatarFileName] = useState<string | null>(null);
  const [previewText, setPreviewText] = useState("");
  const [selectedCharacterIds, setSelectedCharacterIds] = useState<string[]>([]);
  const [characters, setCharacters] = useState<CharacterResponse[]>([]);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUsageDialogOpen, setIsUsageDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !voice) {
      return;
    }

    let cancelled = false;

    const loadData = async () => {
      setIsLoadingDetails(true);
      setError(null);

      try {
        const [voiceDetail, myCharacters] = await Promise.all([
          getVoiceById(voice.id),
          getMyCharacters(),
        ]);

        if (cancelled) {
          return;
        }

        setName(voiceDetail.display_name);
        setDescription(voiceDetail.description || "");
        setAvatarFileName(voiceDetail.avatar_file_name ?? null);
        setPreviewText(voiceDetail.preview_text || "");
        setSelectedCharacterIds(voiceDetail.bound_character_ids ?? []);
        setCharacters(myCharacters);
      } catch (loadError) {
        if (!cancelled) {
          setError(getErrorMessage(loadError));
        }
      } finally {
        if (!cancelled) {
          setIsLoadingDetails(false);
        }
      }
    };

    void loadData();

    return () => {
      cancelled = true;
    };
  }, [isOpen, voice]);

  const managedCharacterCount = useMemo(
    () => characters.filter((character) => selectedCharacterIds.includes(character.id)).length,
    [characters, selectedCharacterIds],
  );

  const validateForm = (): string | null => {
    if (!name.trim()) {
      return "请输入音色名称";
    }
    if (name.trim().length > 40) {
      return "音色名称不能超过40个字符";
    }
    if (description.length > 160) {
      return "描述不能超过160个字符";
    }
    if (!previewText.trim()) {
      return "请输入试听文本";
    }
    if (previewText.trim().length > 120) {
      return "试听文本不能超过120个字符";
    }
    return null;
  };

  const handleSubmit = async () => {
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    if (!voice) {
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await patchVoiceById(voice.id, {
        display_name: name.trim(),
        description: description.trim() || null,
        avatar_file_name: avatarFileName,
        preview_text: previewText.trim(),
        character_ids: selectedCharacterIds,
      });
      onSuccess();
      handleClose();
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    if (isSaving) {
      return;
    }
    setError(null);
    setIsUsageDialogOpen(false);
    onClose();
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="max-w-lg rounded-2xl p-0 overflow-hidden bg-white border-none shadow-2xl max-h-[90vh] flex flex-col">
          <DialogHeader className="flex-none flex items-center justify-between p-5 border-b border-gray-100 bg-white z-10">
            <DialogTitle className="text-xl font-bold text-gray-900">
              编辑音色
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto min-h-0 p-5 space-y-5 custom-scrollbar">
            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {isLoadingDetails ? (
              <div className="flex items-center justify-center py-16 text-sm text-gray-500">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                加载音色详情中...
              </div>
            ) : (
              <>
                <div className="space-y-5">
                <VoiceAvatarField
                  value={avatarFileName}
                  onChange={setAvatarFileName}
                  disabled={isSaving}
                />

                <div className="space-y-2">
                  <Label htmlFor="editVoiceName" className="text-sm font-medium text-gray-700">
                    音色名称 <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="editVoiceName"
                    type="text"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="给你的音色起个名字"
                    maxLength={40}
                    disabled={isSaving}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus-visible:outline-none focus-visible:ring-0 focus-visible:!border-gray-200 [&::selection]:bg-blue-500 [&::selection]:text-white"
                  />
                  <p className="text-xs text-gray-500 mt-1">{name.length}/40 字符</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="editVoiceDesc" className="text-sm font-medium text-gray-700">
                    音色描述
                  </Label>
                  <Input
                    id="editVoiceDesc"
                    type="text"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="描述这个音色的特点（选填）"
                    maxLength={160}
                    disabled={isSaving}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus-visible:outline-none focus-visible:ring-0 focus-visible:!border-gray-200 [&::selection]:bg-blue-500 [&::selection]:text-white"
                  />
                  <p className="text-xs text-gray-500 mt-1">{description.length}/160 字符</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="editPreviewText" className="text-sm font-medium text-gray-700">
                    试听文本 <span className="text-red-500">*</span>
                  </Label>
                  <Textarea
                    id="editPreviewText"
                    value={previewText}
                    onChange={(event) => setPreviewText(event.target.value)}
                    placeholder="输入试听时要朗读的文字"
                    maxLength={120}
                    disabled={isSaving}
                    className="min-h-[92px] w-full resize-none border border-gray-200 rounded-lg focus-visible:outline-none focus-visible:ring-0 focus-visible:!border-gray-200 [&::selection]:bg-blue-500 [&::selection]:text-white"
                  />
                  <p className="text-xs text-gray-500 mt-1">{previewText.length}/120 字符</p>
                </div>

                <div className="space-y-3 rounded-xl border border-gray-200 bg-gray-50/70 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm font-medium text-gray-700">使用该音色的角色</Label>
                      <p className="mt-1 text-xs text-gray-500">
                        当前已绑定 {managedCharacterCount} 个角色
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsUsageDialogOpen(true)}
                      disabled={isSaving || isLoadingDetails}
                      className="rounded-lg border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                    >
                      <Users data-icon="inline-start" />
                      管理角色
                    </Button>
                  </div>
                </div>
                </div>
              </>
            )}
          </div>

          <DialogFooter className="flex-none flex gap-3 p-5 border-t border-gray-100 bg-white z-10">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isSaving}
              className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg font-medium hover:bg-gray-50 transition-colors"
            >
              取消
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSaving || isLoadingDetails}
              className="flex-1 px-4 py-2.5 bg-[#3964FE] text-white rounded-lg font-medium hover:bg-[#2a4fd6] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  保存中...
                </>
              ) : (
                "保存"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <VoiceUsageManagerDialog
        isOpen={isUsageDialogOpen}
        onClose={() => setIsUsageDialogOpen(false)}
        onSave={(characterIds) => {
          setSelectedCharacterIds(characterIds);
          setIsUsageDialogOpen(false);
        }}
        characters={characters}
        selectedCharacterIds={selectedCharacterIds}
        voiceName={name.trim() || voice?.displayName || "当前音色"}
        isLoading={isLoadingDetails}
      />
    </>
  );
}
