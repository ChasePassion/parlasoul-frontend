"use client";

import { useMemo, useRef, useState } from "react";
import { Loader2, Mic2, Plus, Trash2, UserRound } from "lucide-react";

import AvatarCropper from "@/components/AvatarCropper";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getMyCharacters, type CharacterResponse, uploadFile } from "@/lib/api";
import { resolveCharacterAvatarSrc, resolveVoiceAvatarSrc } from "@/lib/character-avatar";
import { getErrorMessage } from "@/lib/error-map";

interface VoiceAvatarFieldProps {
  value: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
}

export default function VoiceAvatarField({
  value,
  onChange,
  disabled = false,
}: VoiceAvatarFieldProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [isCharacterDialogOpen, setIsCharacterDialogOpen] = useState(false);
  const [characterOptions, setCharacterOptions] = useState<CharacterResponse[]>([]);
  const [isCharacterLoading, setIsCharacterLoading] = useState(false);

  const avatarSrc = useMemo(() => resolveVoiceAvatarSrc(value), [value]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    setAvatarError(null);
    setSelectedFile(file);
  };

  const handleCropConfirm = async (croppedBlob: Blob) => {
    setSelectedFile(null);
    setIsUploading(true);
    setAvatarError(null);

    try {
      const file = new File([croppedBlob], "voice-avatar.jpg", { type: "image/jpeg" });
      const result = await uploadFile(file);
      onChange(result.url);
    } catch (error) {
      setAvatarError(getErrorMessage(error));
    } finally {
      setIsUploading(false);
    }
  };

  const handleOpenCharacterDialog = async () => {
    setIsCharacterDialogOpen(true);
    if (characterOptions.length > 0) {
      return;
    }

    setIsCharacterLoading(true);
    setAvatarError(null);
    try {
      const items = await getMyCharacters();
      setCharacterOptions(items);
    } catch (error) {
      setAvatarError(getErrorMessage(error));
    } finally {
      setIsCharacterLoading(false);
    }
  };

  return (
    <>
      <div className="flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || isUploading}
          className="relative h-24 w-24 rounded-lg bg-gray-100 border-2 border-dashed border-gray-300 cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all overflow-hidden disabled:cursor-not-allowed disabled:opacity-60"
        >
          {avatarSrc ? (
            <Avatar className="h-full w-full rounded-lg">
              <AvatarImage src={avatarSrc} alt="Voice avatar" className="object-cover" />
              <AvatarFallback className="rounded-lg bg-gray-100 text-gray-400">
                <Mic2 className="size-7" />
              </AvatarFallback>
            </Avatar>
          ) : (
            <div className="flex h-full flex-col items-center justify-center text-gray-400">
              <Plus className="size-8" />
              <span className="mt-1 text-xs">上传头像</span>
            </div>
          )}
          {isUploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/80">
              <Loader2 className="size-6 animate-spin text-[#3964FE]" />
            </div>
          )}
        </button>

        <div className="flex flex-wrap justify-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleOpenCharacterDialog}
            disabled={disabled || isUploading}
            className="rounded-lg border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
          >
            <UserRound data-icon="inline-start" />
            使用角色头像
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => onChange(null)}
            disabled={disabled || isUploading || !value}
            className="rounded-lg border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
          >
            <Trash2 data-icon="inline-start" />
            清空头像
          </Button>
        </div>

        <p className="text-center text-xs text-gray-500">
          点击头像上传并裁剪，也可以直接复用现有角色头像。
        </p>
        {avatarError && <p className="text-center text-xs text-red-500">{avatarError}</p>}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        onChange={handleFileChange}
        className="hidden"
      />

      {selectedFile && (
        <AvatarCropper
          file={selectedFile}
          onConfirm={handleCropConfirm}
          onCancel={() => setSelectedFile(null)}
        />
      )}

      <Dialog open={isCharacterDialogOpen} onOpenChange={setIsCharacterDialogOpen}>
        <DialogContent className="max-w-lg rounded-2xl p-0 overflow-hidden bg-white border-none shadow-2xl">
          <DialogHeader className="border-b border-gray-100 px-5 py-4">
            <DialogTitle className="text-lg font-semibold text-gray-900">
              选择角色头像
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto px-5 py-4 custom-scrollbar">
            {isCharacterLoading ? (
              <div className="flex items-center justify-center py-12 text-sm text-gray-500">
                <Loader2 className="mr-2 size-4 animate-spin" />
                加载角色中...
              </div>
            ) : characterOptions.length === 0 ? (
              <div className="py-10 text-center text-sm text-gray-500">
                暂无可复用头像的角色
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {characterOptions.map((character) => (
                  <button
                    key={character.id}
                    type="button"
                    onClick={() => {
                      onChange(character.avatar_file_name ?? null);
                      setIsCharacterDialogOpen(false);
                    }}
                    className="flex items-center gap-3 rounded-xl border border-gray-200 px-3 py-3 text-left transition-colors hover:border-blue-200 hover:bg-blue-50/70"
                  >
                    <Avatar className="h-11 w-11 rounded-xl">
                      <AvatarImage
                        src={resolveCharacterAvatarSrc(character.avatar_file_name)}
                        alt={character.name}
                        className="object-cover"
                      />
                      <AvatarFallback className="rounded-xl bg-gray-100 text-gray-600">
                        {character.name.slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-900">{character.name}</p>
                      <p className="truncate text-xs text-gray-500">{character.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
