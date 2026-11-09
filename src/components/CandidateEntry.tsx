"use client";

import { AudioLines, UserPlus } from "lucide-react";

export type CreateIntent = "character" | "voice";

interface CandidateCardProps {
  icon: typeof UserPlus;
  title: string;
  description: string;
  onClick: () => void;
  disabled?: boolean;
}

function CandidateCard({
  icon: Icon,
  title,
  description,
  onClick,
  disabled,
}: CandidateCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex w-full max-w-[420px] items-center gap-2.5 rounded-xl border border-[#3964FE]/20 bg-white px-3 py-2.5 text-left transition-colors hover:border-[#3964FE]/40 hover:bg-[#3964FE]/[0.03] disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[9px] bg-[#3964FE]/10 text-[#3964FE]">
        <Icon className="h-4 w-4" />
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[13.5px] font-medium text-text-primary">
          {title}
        </span>
        <span className="text-[11.5px] leading-[1.5] text-gray-500">
          {description}
        </span>
      </span>
    </button>
  );
}

export default function CandidateEntry({
  onPick,
  disabled,
}: {
  onPick: (intent: CreateIntent) => void;
  disabled: boolean;
}) {
  return (
    <div className="mx-auto flex w-full max-w-[44rem] flex-col gap-4 px-4 pb-4 pt-6">
      <p className="w-full text-sm leading-7 text-text-primary">
        我可以帮你创建角色，或者克隆一个专属于你的音色，你想试试哪个？
      </p>
      <CandidateCard
        icon={UserPlus}
        title="创建角色"
        description="描述一个角色，我来写设定、画头像、配音色。"
        disabled={disabled}
        onClick={() => onPick("character")}
      />
      <CandidateCard
        icon={AudioLines}
        title="克隆音色"
        description="发一段录音，我来裁剪并复刻成专属音色。"
        disabled={disabled}
        onClick={() => onPick("voice")}
      />
    </div>
  );
}
