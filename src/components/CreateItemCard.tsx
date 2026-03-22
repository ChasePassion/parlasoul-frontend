"use client";

import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface CreateItemCardProps {
  onClick: () => void;
  title: string;
  description?: string;
  className?: string;
  icon?: React.ReactNode;
}

export default function CreateItemCard({
  onClick,
  title,
  description,
  className = "",
  icon,
}: CreateItemCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "group relative flex cursor-pointer flex-col items-center justify-center gap-3 overflow-hidden rounded-[20px] border-2 border-dashed border-gray-200 bg-gray-50/50 text-gray-400 transition-all duration-300 hover:border-[#3964FE]/50 hover:bg-[#3964FE]/5 hover:text-[#3964FE] hover:shadow-sm",
        className
      )}
    >
      {/* 优化的 + 按钮 */}
      <div className="relative flex h-14 w-14 items-center justify-center transition-transform duration-500 ease-out group-hover:-translate-y-1 z-10">
        
        {/* 中心圆环 (Solid circle container) */}
        <div className="absolute inset-0 rounded-full bg-white shadow-sm border border-gray-200 transition-all duration-500 ease-out group-hover:border-[#3964FE]/40 group-hover:shadow-[0_0_20px_rgba(57,100,254,0.15)] group-hover:scale-110" />
        
        {/* + 按钮图标 (Icon with rotation) */}
        <div className="relative transition-all duration-500 ease-out group-hover:rotate-90 group-hover:scale-[1.15]">
          {icon || <Plus className="h-6 w-6 stroke-[2.5px]" />}
        </div>
      </div>

      {/* 原本的文本结构 */}
      <div className="flex flex-col items-center gap-1 z-10">
        <span className="font-semibold text-sm">{title}</span>
        {description && (
          <span className="text-xs text-gray-400 group-hover:text-[#3964FE]/70 px-4 text-center transition-colors">
            {description}
          </span>
        )}
      </div>
    </div>
  );
}
