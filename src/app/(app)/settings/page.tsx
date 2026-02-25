"use client";

import { useEffect } from "react";
import WorkspaceFrame from "@/components/layout/WorkspaceFrame";
import { useSidebar } from "../layout";
import { useUserSettings } from "@/lib/user-settings-context";

/* ---- Inline Toggle component ---- */
function Toggle({
    checked,
    onChange,
    disabled,
    label,
}: {
    checked: boolean;
    onChange: (v: boolean) => void;
    disabled?: boolean;
    label: string;
}) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={label}
            disabled={disabled}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
                checked ? "bg-blue-500" : "bg-gray-300"
            }`}
            onClick={() => onChange(!checked)}
        >
            <span
                className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform duration-200 ease-in-out ${
                    checked ? "translate-x-5" : "translate-x-0"
                }`}
            />
        </button>
    );
}

export default function SettingsPage() {
    const { setSelectedCharacterId } = useSidebar();
    const {
        messageFontSize,
        setMessageFontSize,
        minMessageFontSize,
        maxMessageFontSize,
        displayMode,
        setDisplayMode,
        knowledgeCardEnabled,
        setKnowledgeCardEnabled,
        mixedInputAutoTranslateEnabled,
        setMixedInputAutoTranslateEnabled,
        isLoading,
        isSaving,
        error,
        retrySync,
    } = useUserSettings();

    useEffect(() => {
        setSelectedCharacterId(null);
    }, [setSelectedCharacterId]);

    const quickSizes = [14, 16, 18, 20, 24];

    return (
        <WorkspaceFrame>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
                <div className="mx-auto w-full max-w-4xl">
                    <div className="mb-8">
                        <h1 className="text-3xl font-bold text-gray-900">设置</h1>
                        <p className="mt-2 text-sm text-gray-500">
                            个性化你的聊天体验。所有设置会同步到账号。
                        </p>
                    </div>

                    {/* ---- Message Font Size ---- */}
                    <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <h2 className="text-lg font-semibold text-gray-900">Message 字号</h2>
                                <p className="mt-1 text-sm text-gray-500">
                                    调整消息正文显示大小（{minMessageFontSize}-{maxMessageFontSize}px）
                                </p>
                            </div>
                            <span className="rounded-lg bg-gray-100 px-3 py-1 text-sm font-semibold text-gray-700">
                                {messageFontSize}px
                            </span>
                        </div>

                        <div className="mt-5">
                            <input
                                type="range"
                                min={minMessageFontSize}
                                max={maxMessageFontSize}
                                step={1}
                                value={messageFontSize}
                                onChange={(e) => setMessageFontSize(Number(e.target.value))}
                                className="h-2 w-full cursor-pointer accent-blue-600"
                                aria-label="Message 字号"
                            />
                            <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                                <span>{minMessageFontSize}px</span>
                                <span>{maxMessageFontSize}px</span>
                            </div>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                            {quickSizes.map((size) => (
                                <button
                                    key={size}
                                    type="button"
                                    onClick={() => setMessageFontSize(size)}
                                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${messageFontSize === size
                                            ? "bg-blue-600 text-white"
                                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                        }`}
                                >
                                    {size}px
                                </button>
                            ))}
                        </div>

                        <div className="mt-5 rounded-xl border border-gray-100 bg-gray-50 p-4">
                            <p className="text-xs uppercase tracking-wide text-gray-500">预览</p>
                            <p
                                className="mt-2 leading-relaxed text-gray-800"
                                style={{ fontSize: `${messageFontSize}px` }}
                            >
                                This is a preview message. 这是预览文本，字号会实时同步到聊天界面。
                            </p>
                        </div>
                    </section>

                    {/* ---- Phase 1: Chat Learning Settings ---- */}
                    <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                        <h2 className="text-lg font-semibold text-gray-900 mb-1">学习辅助</h2>
                        <p className="text-sm text-gray-500 mb-5">聊天中的学习工具与显示偏好。</p>

                        <div className="divide-y divide-gray-100">
                            {/* Display Mode */}
                            <div className="flex items-center justify-between py-4 first:pt-0 last:pb-0">
                                <div className="pr-4">
                                    <p className="text-sm font-medium text-gray-900">详细模式</p>
                                    <p className="mt-0.5 text-sm text-gray-500">
                                        开启后，助手消息下方显示中文翻译和美式音标
                                    </p>
                                </div>
                                <Toggle
                                    checked={displayMode === "detailed"}
                                    onChange={(v) => setDisplayMode(v ? "detailed" : "concise")}
                                    label="详细模式"
                                />
                            </div>

                            {/* Knowledge Card */}
                            <div className="flex items-center justify-between py-4 first:pt-0 last:pb-0">
                                <div className="pr-4">
                                    <p className="text-sm font-medium text-gray-900">知识卡</p>
                                    <p className="mt-0.5 text-sm text-gray-500">
                                        开启后，可在每条助手消息旁查看词组解析与收藏
                                    </p>
                                </div>
                                <Toggle
                                    checked={knowledgeCardEnabled}
                                    onChange={setKnowledgeCardEnabled}
                                    label="知识卡"
                                />
                            </div>

                            {/* Mixed Input Auto Translate */}
                            <div className="flex items-center justify-between py-4 first:pt-0 last:pb-0">
                                <div className="pr-4">
                                    <p className="text-sm font-medium text-gray-900">混输自动转英文</p>
                                    <p className="mt-0.5 text-sm text-gray-500">
                                        发送含中文的消息时，自动翻译为英文发送给角色
                                    </p>
                                </div>
                                <Toggle
                                    checked={mixedInputAutoTranslateEnabled}
                                    onChange={setMixedInputAutoTranslateEnabled}
                                    label="混输自动转英文"
                                />
                            </div>
                        </div>
                    </section>

                    {/* ---- Sync Status ---- */}
                    <div className="mt-4 flex min-h-6 items-center gap-3 text-sm">
                        {isLoading ? <span className="text-gray-500">正在加载设置...</span> : null}
                        {isSaving ? <span className="text-blue-600">正在同步...</span> : null}
                        {!isLoading && !isSaving && !error ? (
                            <span className="text-green-600">已同步</span>
                        ) : null}
                        {error ? (
                            <>
                                <span className="text-red-600">{error}</span>
                                <button
                                    type="button"
                                    onClick={() => {
                                        void retrySync();
                                    }}
                                    className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
                                >
                                    重试
                                </button>
                            </>
                        ) : null}
                    </div>
                </div>
            </div>
        </WorkspaceFrame>
    );
}
