"use client";

import { useState, useEffect, useCallback } from "react";
import { Check, Loader2, AlertCircle } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import AudioPreviewButton from "./AudioPreviewButton";
import { listSelectableVoices } from "@/lib/api";
import { resolveVoiceAvatarSrc } from "@/lib/character-avatar";
import { getErrorMessage } from "@/lib/error-map";
import {
  groupVoicesBySource,
  type VoiceGroup,
  type VoiceDisplayInfo,
} from "@/lib/voice-adapter";
import type { VoiceSelectableItem } from "@/lib/api";

interface VoiceSelectorProps {
  selectedVoiceId: string | null;
  onSelectVoice: (voice: VoiceSelectableItem) => void;
  disabled?: boolean;
}

type FetchState = "idle" | "loading" | "success" | "error";

export default function VoiceSelector({
  selectedVoiceId,
  onSelectVoice,
  disabled = false,
}: VoiceSelectorProps) {
  const [fetchState, setFetchState] = useState<FetchState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [voiceGroups, setVoiceGroups] = useState<VoiceGroup[]>([]);

  const loadVoices = useCallback(async () => {
    setFetchState("loading");
    setError(null);

    try {
      const response = await listSelectableVoices({
        include_system: true,
        include_user_custom: true,
      });
      const groups = groupVoicesBySource(response.items);
      setVoiceGroups(groups);
      setFetchState("success");
    } catch (err) {
      setError(getErrorMessage(err));
      setFetchState("error");
    }
  }, []);

  useEffect(() => {
    if (!disabled) {
      loadVoices();
    }
  }, [loadVoices, disabled]);

  if (disabled) {
    return null;
  }

  if (fetchState === "loading") {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        <span className="ml-2 text-sm text-gray-500">加载音色列表...</span>
      </div>
    );
  }

  if (fetchState === "error") {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-red-50 p-4 text-red-600">
        <AlertCircle className="h-5 w-5" />
        <span className="text-sm">{error}</span>
        <Button variant="ghost" size="sm" onClick={loadVoices}>
          重试
        </Button>
      </div>
    );
  }

  if (fetchState === "success" && voiceGroups.length === 0) {
    return (
      <div className="rounded-lg bg-gray-50 p-4 text-center">
        <p className="text-sm text-gray-500">暂无可用音色</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {voiceGroups.map((group) => (
        <div key={group.label} className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700">{group.label}</h4>
          <div className="grid grid-cols-2 gap-2">
            {group.voices.map((voice: VoiceDisplayInfo) => {
              const isSelected = selectedVoiceId === voice.id;
              return (
                <div
                  key={voice.id}
                  role="button"
                  tabIndex={0}
                  onClick={() =>
                    onSelectVoice({
                      id: voice.id,
                      display_name: voice.displayName,
                      source_type: voice.sourceType,
                      provider: voice.provider,
                      provider_model: voice.providerModel,
                      provider_voice_id: voice.providerVoiceId,
                      avatar_file_name: voice.avatarFileName,
                      preview_text: voice.previewText,
                      preview_audio_url: voice.previewAudioUrl,
                      usage_hint: voice.description || null,
                    })
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelectVoice({
                        id: voice.id,
                        display_name: voice.displayName,
                        source_type: voice.sourceType,
                        provider: voice.provider,
                        provider_model: voice.providerModel,
                        provider_voice_id: voice.providerVoiceId,
                        avatar_file_name: voice.avatarFileName,
                        preview_text: voice.previewText,
                        preview_audio_url: voice.previewAudioUrl,
                        usage_hint: voice.description || null,
                      });
                    }
                  }}
                  className={`flex items-center gap-3 rounded-xl border-[0.4px] p-3 text-left transition-all ${
                    isSelected
                      ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500"
                      : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                  } ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
                >
                  <div className="relative shrink-0">
                    <Avatar className="h-10 w-10 rounded-lg border border-gray-200">
                      <AvatarImage
                        src={resolveVoiceAvatarSrc(voice.avatarFileName)}
                        alt={voice.displayName}
                        className="object-cover"
                      />
                      <AvatarFallback
                        className={isSelected ? "bg-blue-100 text-blue-600" : "bg-gray-100 text-gray-500"}
                      >
                        {voice.displayName.slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    {isSelected && (
                      <div className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#3964FE] text-white">
                        <Check className="h-3 w-3" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {voice.displayName}
                    </p>
                    {voice.description && (
                      <p className="text-xs text-gray-500 truncate">
                        {voice.description}
                      </p>
                    )}
                  </div>

                  {(voice.previewAudioUrl || voice.previewText) && (
                    <div onClick={(e) => e.stopPropagation()}>
                      <AudioPreviewButton
                        audioUrl={voice.previewAudioUrl}
                        previewVoiceId={
                          voice.sourceType === "clone" && voice.previewText
                            ? voice.id
                            : null
                        }
                        size="sm"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
