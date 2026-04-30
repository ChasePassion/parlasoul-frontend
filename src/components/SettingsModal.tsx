"use client";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useUserSettings } from "@/lib/user-settings-context";
import { useAuth } from "@/lib/auth-context";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    CheckCircle2,
    Loader2,
    AlertCircle,
    GraduationCap,
    UserRound,
} from "lucide-react";
import { useState } from "react";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

export function SettingsModal({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) {
    const {
        messageFontSize,
        setMessageFontSize,
        minMessageFontSize,
        maxMessageFontSize,
        displayMode,
        setDisplayMode,
        replyCardEnabled,
        setReplyCardEnabled,
        mixedInputAutoTranslateEnabled,
        setMixedInputAutoTranslateEnabled,
        autoReadAloudEnabled,
        setAutoReadAloudEnabled,
        preferredExpressionBiasEnabled,
        setPreferredExpressionBiasEnabled,
        memoryEnabled,
        setMemoryEnabled,
        isLoading,
        isSaving,
        error,
        retrySync,
    } = useUserSettings();
    const { entitlements, isEntitlementsLoading } = useAuth();

    const [activeTab, setActiveTab] = useState<"preferences" | "learning">("preferences");
    const canUseMemoryFeature = entitlements?.features.memory_feature ?? null;
    const isMemoryLocked = canUseMemoryFeature === false;
    const isMemoryReadonly = isEntitlementsLoading || canUseMemoryFeature !== true;
    const displayedMemoryEnabled = canUseMemoryFeature === true ? memoryEnabled : false;

    const handleOpenBilling = () => {
        window.location.assign("/pricing");
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[960px] sm:max-w-[960px] w-[90vw] p-0 overflow-hidden bg-white flex h-[650px] border-none shadow-2xl rounded-2xl gap-0">
                <VisuallyHidden>
                    <DialogTitle>设置</DialogTitle>
                </VisuallyHidden>
                <div className="w-[240px] bg-[#f9f9f9] p-4 border-r border-gray-100 flex flex-col pt-6 shrink-0 h-full">
                    <h2 className="text-2xl font-bold text-gray-900 mb-6 px-3">设置</h2>

                    <nav className="space-y-1">
                        <button
                            onClick={() => setActiveTab("preferences")}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-[15px] font-medium ${
                                activeTab === "preferences"
                                    ? "bg-white text-gray-900 shadow-sm border border-gray-200/60"
                                    : "text-gray-600 hover:bg-gray-200/50 hover:text-gray-900 border border-transparent"
                            }`}
                        >
                            <UserRound className="w-[18px] h-[18px]" />
                            个人偏好
                        </button>

                        <button
                            onClick={() => setActiveTab("learning")}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-[15px] font-medium ${
                                activeTab === "learning"
                                    ? "bg-white text-gray-900 shadow-sm border border-gray-200/60"
                                    : "text-gray-600 hover:bg-gray-200/50 hover:text-gray-900 border border-transparent"
                            }`}
                        >
                            <GraduationCap className="w-[18px] h-[18px]" />
                            学习辅助
                        </button>
                    </nav>

                    <div className="mt-auto px-1 pb-4">
                        {isLoading ? (
                            <Badge variant="secondary" className="gap-1.5 bg-gray-100 text-gray-600 shadow-none border-transparent w-full justify-center py-1.5 font-normal">
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                <span className="text-xs">加载中</span>
                            </Badge>
                        ) : isSaving ? (
                            <Badge variant="secondary" className="gap-1.5 bg-blue-50 text-blue-700 shadow-none border-blue-100 w-full justify-center py-1.5 font-normal">
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                <span className="text-xs">同步中</span>
                            </Badge>
                        ) : error ? (
                            <div className="flex flex-col gap-2">
                                <Badge variant="secondary" className="gap-1.5 bg-red-50 text-red-700 shadow-none border-red-100 w-full justify-center text-center py-1.5 font-normal">
                                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                                    <span className="text-[11px] truncate" title={error}>{error}</span>
                                </Badge>
                                <button
                                    type="button"
                                    onClick={() => void retrySync()}
                                    className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 w-full shadow-sm"
                                >
                                    重试同步
                                </button>
                            </div>
                        ) : (
                            <Badge variant="secondary" className="gap-1.5 bg-green-50/80 text-green-700 shadow-none border-green-200/60 w-full justify-center text-center py-1.5 font-normal hover:bg-green-50/80">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                <span className="text-xs">已自动同步</span>
                            </Badge>
                        )}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto px-10 pb-10 pt-6 custom-scrollbar relative h-full">
                    {activeTab === "preferences" && (
                        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 max-w-2xl">
                            <h3 className="text-xl font-semibold text-gray-900 mb-8 pb-4 border-b border-gray-100">个人偏好</h3>

                            <div className="flex flex-col">
                                <div className="pb-5 pt-0">
                                    <div className="flex items-center justify-between gap-4">
                                        <div>
                                            <h4 className="text-gray-900 text-[15px]" style={{ fontWeight: 475 }}>聊天消息字号</h4>
                                            <p className="mt-1 text-[13px] text-gray-500 leading-relaxed">调整消息正文显示大小，让阅读更贴合你的习惯</p>
                                        </div>
                                        <div className="flex h-8 min-w-12 px-2 items-center justify-center rounded-md bg-gray-50 border border-gray-100 text-sm font-medium text-gray-700 shadow-sm">
                                            {messageFontSize}px
                                        </div>
                                    </div>

                                    <Slider
                                        max={maxMessageFontSize}
                                        min={minMessageFontSize}
                                        step={1}
                                        value={[messageFontSize]}
                                        onValueChange={(val) => setMessageFontSize(val[0])}
                                        className="mt-6"
                                    />

                                    <div className="mt-6 flex flex-col items-start rounded-xl border border-gray-100 bg-gray-50 p-6 shadow-sm">
                                        <span className="mb-4 text-[11px] font-semibold tracking-wider uppercase text-gray-400">字号预览</span>
                                        <div className="rounded-2xl bg-[#EBF4FF] px-4 py-3 text-gray-800 shadow-xs border border-blue-100/50">
                                            <p style={{ fontSize: `${messageFontSize}px` }} className="transition-all leading-relaxed">
                                                This is a preview message. <br />
                                                这是预览文本，字号会实时同步到聊天界面。
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <Separator className="opacity-60" />

                                <div className="py-5">
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="space-y-0.5 pr-6">
                                            <h4 className="text-gray-900 text-[15px]" style={{ fontWeight: 475 }}>角色记忆</h4>
                                            <p className="text-[13px] text-gray-500 leading-relaxed">开启后，系统会记录并在后续对话中检索与你相关的长期记忆。</p>
                                        </div>
                                        <Switch
                                            checked={displayedMemoryEnabled}
                                            onCheckedChange={setMemoryEnabled}
                                            disabled={isMemoryReadonly}
                                        />
                                    </div>

                                    {isEntitlementsLoading ? (
                                        <div className="mt-3">
                                            <p className="text-[12px] text-gray-400 leading-relaxed">
                                                正在校验当前套餐权益，记忆开关暂时不可编辑。
                                            </p>
                                        </div>
                                    ) : null}

                                    {isMemoryLocked ? (
                                        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                                            <div className="min-w-0 flex-1">
                                                <p className="text-[13px] font-medium text-amber-900">当前套餐暂不支持角色记忆</p>
                                                <p className="mt-1 text-[12px] leading-relaxed text-amber-700">
                                                    升级到 Plus 或 Pro 后，即可开启记忆采集与回答时的记忆检索。
                                                </p>
                                            </div>
                                            <Button type="button" variant="outline" size="sm" onClick={handleOpenBilling}>
                                                订阅管理
                                            </Button>
                                        </div>
                                    ) : null}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === "learning" && (
                        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 max-w-2xl">
                            <h3 className="text-xl font-semibold text-gray-900 mb-8 pb-4 border-b border-gray-100">学习辅助</h3>

                            <div className="flex flex-col">
                                <div className="flex items-center justify-between pb-5 pt-0">
                                    <div className="space-y-0.5 pr-6">
                                        <h4 className="text-gray-900 text-[15px]" style={{ fontWeight: 475 }}>详细模式</h4>
                                        <p className="text-[13px] text-gray-500 leading-relaxed">开启后，助手消息下方显示中文翻译</p>
                                    </div>
                                    <Switch
                                        checked={displayMode === "detailed"}
                                        onCheckedChange={(c) => setDisplayMode(c ? "detailed" : "concise")}
                                    />
                                </div>
                                <Separator className="opacity-60" />

                                <div className="flex items-center justify-between py-5">
                                    <div className="space-y-0.5 pr-6">
                                        <h4 className="text-gray-900 text-[15px]" style={{ fontWeight: 475 }}>回复卡</h4>
                                        <p className="text-[13px] text-gray-500 leading-relaxed">开启后，可在每条助手消息旁查看整条回复的翻译与词组解析</p>
                                    </div>
                                    <Switch
                                        checked={replyCardEnabled}
                                        onCheckedChange={setReplyCardEnabled}
                                    />
                                </div>
                                <Separator className="opacity-60" />

                                <div className="flex items-center justify-between py-5">
                                    <div className="space-y-0.5 pr-6">
                                        <h4 className="text-gray-900 text-[15px]" style={{ fontWeight: 475 }}>混输自动转英文</h4>
                                        <p className="text-[13px] text-gray-500 leading-relaxed">发送含中文的消息时，自动翻译为英文发送给角色</p>
                                    </div>
                                    <Switch
                                        checked={mixedInputAutoTranslateEnabled}
                                        onCheckedChange={setMixedInputAutoTranslateEnabled}
                                    />
                                </div>
                                <Separator className="opacity-60" />

                                <div className="flex items-center justify-between py-5">
                                    <div className="space-y-0.5 pr-6">
                                        <h4 className="text-gray-900 text-[15px]" style={{ fontWeight: 475 }}>自动朗读</h4>
                                        <p className="text-[13px] text-gray-500 leading-relaxed">开启后，AI 回复时会实时语音朗读</p>
                                    </div>
                                    <Switch
                                        checked={autoReadAloudEnabled}
                                        onCheckedChange={setAutoReadAloudEnabled}
                                    />
                                </div>
                                <Separator className="opacity-60" />

                                <div className="flex items-center justify-between py-5">
                                    <div className="space-y-0.5 pr-6">
                                        <h4 className="text-gray-900 text-[15px]" style={{ fontWeight: 475 }}>收藏复用</h4>
                                        <p className="text-[13px] text-gray-500 leading-relaxed">开启后，AI 会自然优先使用你收藏过的单词和句子。</p>
                                    </div>
                                    <Switch
                                        checked={preferredExpressionBiasEnabled}
                                        onCheckedChange={setPreferredExpressionBiasEnabled}
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
