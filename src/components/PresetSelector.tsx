"use client";

import { useRouter } from "next/navigation";
import { Check, Lock } from "lucide-react";
import { LLM_PRESETS, canAccessPreset } from "@/lib/presets";
import type { LLMPresetId } from "@/lib/presets";
import type { UserEntitlementTier } from "@/lib/api-service";

interface PresetSelectorProps {
  selectedPresetId: LLMPresetId | null | undefined;
  onSelectPreset: (presetId: LLMPresetId) => void;
  userTier: UserEntitlementTier;
  disabled?: boolean;
}

export default function PresetSelector({
  selectedPresetId,
  onSelectPreset,
  userTier,
  disabled = false,
}: PresetSelectorProps) {
  const router = useRouter();

  return (
    <div className="grid grid-cols-2 gap-2">
      {LLM_PRESETS.map((preset) => {
        const isSelected = selectedPresetId === preset.id;
        const accessible = canAccessPreset(preset.id, userTier);
        const isLocked = !accessible;

        const handleClick = () => {
          if (disabled) return;
          if (isLocked) {
            router.push("/pricing");
            return;
          }
          onSelectPreset(preset.id);
        };

        return (
          <div
            key={preset.id}
            role="button"
            tabIndex={0}
            onClick={handleClick}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleClick();
              }
            }}
            className={`relative flex flex-col gap-1 rounded-xl border-[0.4px] p-3 text-left transition-all ${
              isSelected
                ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500"
                : isLocked
                  ? "border-amber-200 bg-amber-50/50"
                  : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
            } ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
          >
            <div className="flex items-center justify-between">
              <p
                className={`text-sm font-medium ${
                  isSelected ? "text-blue-700" : "text-gray-900"
                }`}
              >
                {preset.name}
              </p>
              {isSelected && (
                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#3964FE] text-white">
                  <Check className="h-3 w-3" />
                </div>
              )}
              {isLocked && (
                <Lock className="h-4 w-4 shrink-0 text-amber-500" />
              )}
            </div>
            <p className="text-xs text-gray-500">{preset.description}</p>
            {isLocked && (
              <p className="text-xs text-amber-600">升级 Plus/Pro 解锁</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
