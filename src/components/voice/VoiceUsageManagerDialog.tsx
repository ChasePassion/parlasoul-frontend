"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { CharacterResponse } from "@/lib/api";
import { resolveCharacterAvatarSrc } from "@/lib/character-avatar";

interface VoiceUsageManagerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (characterIds: string[]) => void;
  characters: CharacterResponse[];
  selectedCharacterIds: string[];
  voiceName: string;
  excludeCharacterId?: string;
  isLoading?: boolean;
  helperText?: string;
}

export default function VoiceUsageManagerDialog({
  isOpen,
  onClose,
  onSave,
  characters,
  selectedCharacterIds,
  voiceName,
  excludeCharacterId,
  isLoading = false,
  helperText,
}: VoiceUsageManagerDialogProps) {
  const [draftIds, setDraftIds] = useState<string[]>(selectedCharacterIds);

  useEffect(() => {
    if (isOpen) {
      setDraftIds(selectedCharacterIds);
    }
  }, [isOpen, selectedCharacterIds]);

  const filteredCharacters = useMemo(
    () => characters.filter((character) => character.id !== excludeCharacterId),
    [characters, excludeCharacterId],
  );

  return (
    <Dialog open={isOpen} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="max-w-lg rounded-2xl p-0 overflow-hidden bg-white border-none shadow-2xl">
        <DialogHeader className="border-b border-gray-100 px-5 py-4">
          <DialogTitle className="text-lg font-semibold text-gray-900">
            管理使用角色
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3 px-5 py-4">
          <div className="rounded-xl bg-blue-50 px-4 py-3">
            <p className="text-sm font-medium text-gray-900">{voiceName}</p>
            <p className="mt-1 text-xs text-gray-500">
              勾选后这些角色会使用该音色，取消勾选后会退回默认音色。
            </p>
            {helperText && <p className="mt-2 text-xs text-gray-500">{helperText}</p>}
          </div>

          <div className="max-h-[48vh] overflow-y-auto custom-scrollbar">
            {isLoading ? (
              <div className="flex items-center justify-center py-12 text-sm text-gray-500">
                <Loader2 className="mr-2 size-4 animate-spin" />
                加载角色中...
              </div>
            ) : filteredCharacters.length === 0 ? (
              <div className="py-10 text-center text-sm text-gray-500">
                暂无可管理的角色
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {filteredCharacters.map((character) => {
                  const checked = draftIds.includes(character.id);
                  return (
                    <label
                      key={character.id}
                      className="flex cursor-pointer items-center gap-3 rounded-xl border border-gray-200 px-3 py-3 transition-colors hover:border-blue-200 hover:bg-blue-50/60"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(nextChecked) => {
                          setDraftIds((current) => {
                            if (nextChecked) {
                              return current.includes(character.id)
                                ? current
                                : [...current, character.id];
                            }
                            return current.filter((id) => id !== character.id);
                          });
                        }}
                      />
                      <Avatar className="size-11 rounded-xl">
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
                        <p className="truncate text-sm font-medium text-gray-900">
                          {character.name}
                        </p>
                        <p className="truncate text-xs text-gray-500">
                          {character.description}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex gap-3 border-t border-gray-100 px-5 py-4">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="flex-1 rounded-lg border-gray-200 text-gray-700 hover:bg-gray-50"
          >
            取消
          </Button>
          <Button
            type="button"
            onClick={() => onSave(draftIds)}
            className="flex-1 rounded-lg bg-[#3964FE] text-white hover:bg-[#2a4fd6]"
          >
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
