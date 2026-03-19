"use client";

import { useState, useEffect, useCallback } from "react";
import { Check, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import AudioPreviewButton from "./AudioPreviewButton";
import { listSelectableVoices } from "@/lib/api";
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
                <button
                  key={voice.id}
                  type="button"
                  onClick={() =>
                    onSelectVoice({
                      id: voice.id,
                      display_name: voice.displayName,
                      source_type: voice.sourceType,
                      provider: voice.provider,
                      provider_model: voice.providerModel,
                      provider_voice_id: voice.providerVoiceId,
                      preview_audio_url: voice.previewAudioUrl,
                      usage_hint: voice.description || null,
                    })
                  }
                  disabled={disabled}
                  className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-all ${
                    isSelected
                      ? "border-blue-500 bg-blue-50 ring-2 ring-blue-500"
                      : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                  } ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
                >
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                      isSelected ? "bg-blue-100" : "bg-gray-100"
                    }`}
                  >
                    {isSelected ? (
                      <Check className="h-5 w-5 text-blue-600" />
                    ) : (
                      <span className="text-lg">🎙️</span>
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

                  {voice.previewAudioUrl && (
                    <div onClick={(e) => e.stopPropagation()}>
                      <AudioPreviewButton
                        audioUrl={voice.previewAudioUrl}
                        size="sm"
                      />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
