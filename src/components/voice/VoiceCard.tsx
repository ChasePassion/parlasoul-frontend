"use client";

import { useState } from "react";
import { Mic, Trash2, MoreVertical, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import AudioPreviewButton from "./AudioPreviewButton";
import type { VoiceCardDisplay } from "@/lib/voice-adapter";

interface VoiceCardProps {
  voice: VoiceCardDisplay;
  onDelete?: (id: string) => void;
  onEdit?: (voice: VoiceCardDisplay) => void;
}

export default function VoiceCard({ voice, onDelete, onEdit }: VoiceCardProps) {
  const [showMenu, setShowMenu] = useState(false);

  const statusColorMap: Record<string, string> = {
    ready: "bg-green-100 text-green-700",
    creating: "bg-yellow-100 text-yellow-700",
    processing: "bg-yellow-100 text-yellow-700",
    failed: "bg-red-100 text-red-700",
    deleting: "bg-gray-100 text-gray-500",
    deleted: "bg-gray-100 text-gray-400",
  };

  const canEdit = voice.canDelete; // Use same permission as delete for now

  return (
    <div className="relative flex w-[280px] flex-col rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition-all hover:shadow-md">
      <div className="flex items-start justify-between">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-50 to-purple-50">
          <Mic className="h-6 w-6 text-blue-600" />
        </div>

        {(onDelete || onEdit) && (voice.canDelete || canEdit) && (
          <div className="relative">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setShowMenu(!showMenu)}
            >
              <MoreVertical className="h-4 w-4" />
            </Button>

            {showMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowMenu(false)}
                />
                <div className="absolute right-0 top-full z-20 mt-1 w-32 rounded-xl bg-white shadow-lg border border-gray-100 p-1">
                  {onEdit && canEdit && (
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        onEdit(voice);
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <Pencil className="h-4 w-4" />
                      编辑
                    </button>
                  )}
                  {onDelete && voice.canDelete && (
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        onDelete(voice.id);
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                      删除
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div className="mt-3 flex-1">
        <h3 className="font-semibold text-gray-900 truncate">{voice.displayName}</h3>
        {voice.description && (
          <p className="mt-1 text-sm text-gray-500 line-clamp-2">{voice.description}</p>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
            statusColorMap[voice.status] || "bg-gray-100 text-gray-600"
          }`}
        >
          {voice.statusText}
        </span>

        <AudioPreviewButton
          audioUrl={voice.previewAudioUrl}
          disabled={!voice.canPreview}
          size="sm"
        />
      </div>
    </div>
  );
}
