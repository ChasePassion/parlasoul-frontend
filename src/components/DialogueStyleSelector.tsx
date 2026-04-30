"use client";

import { Check } from "lucide-react";
import { DIALOGUE_STYLES } from "@/lib/presets";
import type { DialogueStyleId } from "@/lib/presets";

interface DialogueStyleSelectorProps {
  selectedStyleId: DialogueStyleId | null | undefined;
  onSelectStyle: (styleId: DialogueStyleId) => void;
  disabled?: boolean;
}

export default function DialogueStyleSelector({
  selectedStyleId,
  onSelectStyle,
  disabled = false,
}: DialogueStyleSelectorProps) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {DIALOGUE_STYLES.map((style) => {
        const isSelected = selectedStyleId === style.id;
        const isDefault = style.id === "true_nature";

        return (
          <div
            key={style.id}
            role="button"
            tabIndex={0}
            onClick={() => {
              if (!disabled) onSelectStyle(style.id);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                if (!disabled) onSelectStyle(style.id);
              }
            }}
            className={`relative flex flex-col gap-0.5 rounded-xl border-[0.4px] p-3 text-left transition-all ${
              isSelected
                ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500"
                : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
            } ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
          >
            {isSelected && (
              <div className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#3964FE] text-white">
                <Check className="h-3 w-3" />
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <p
                className={`text-sm font-medium ${
                  isSelected ? "text-blue-700" : "text-gray-900"
                }`}
              >
                {style.chineseName}
              </p>
              {isDefault && (
                <span className="text-xs bg-blue-100 text-blue-600 rounded px-1.5 py-px">
                  默认
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500">{style.englishName}</p>
            <p className="text-xs text-gray-400">{style.description}</p>
          </div>
        );
      })}
    </div>
  );
}
