"use client";

import { Mic, Trash2, MoreVertical, Pencil } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import AudioPreviewButton from "./AudioPreviewButton";
import { resolveVoiceAvatarSrc } from "@/lib/character-avatar";
import type { VoiceCardDisplay } from "@/lib/voice-adapter";

interface VoiceCardProps {
  voice: VoiceCardDisplay;
  onDelete?: (id: string) => void;
  onEdit?: (voice: VoiceCardDisplay) => void;
}

export default function VoiceCard({ voice, onDelete, onEdit }: VoiceCardProps) {
  const canEdit = voice.canDelete; // Use same permission as delete for now

  return (
    <div className="relative flex w-[280px] flex-col rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition-all hover:shadow-md">
      <div className="flex items-start justify-between">
        <Avatar className="h-12 w-12 rounded-xl border border-gray-200">
          <AvatarImage
            src={resolveVoiceAvatarSrc({
              avatar_image_key: voice.avatarImageKey,
              avatar_urls: voice.avatarUrls,
            })}
            alt={voice.displayName}
            className="object-cover"
          />
          <AvatarFallback className="rounded-xl bg-gradient-to-br from-blue-50 to-purple-50 text-blue-600">
            <Mic className="h-6 w-6" />
          </AvatarFallback>
        </Avatar>

        {(onDelete || onEdit) && (voice.canDelete || canEdit) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={4} className="w-32">
              {onEdit && canEdit && (
                <DropdownMenuItem onClick={() => onEdit(voice)} className="cursor-pointer">
                  <Pencil className="mr-2 h-4 w-4" />
                  编辑
                </DropdownMenuItem>
              )}
              {onDelete && voice.canDelete && (
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => onDelete(voice.id)}
                  className="cursor-pointer"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  删除
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <div className="mt-3 flex-1">
        <h3 className="font-semibold text-gray-900 truncate">{voice.displayName}</h3>
        {voice.description && (
          <p className="mt-1 text-sm text-gray-500 line-clamp-2">{voice.description}</p>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <p className="text-xs text-gray-400">
          已用于 {voice.boundCharacterCount} 个角色
        </p>
        <AudioPreviewButton
          audioUrl={voice.previewAudioUrl}
          previewVoiceId={
            voice.sourceType === "clone" && voice.previewText ? voice.id : null
          }
          disabled={!voice.canPreview}
          size="sm"
        />
      </div>
    </div>
  );
}
