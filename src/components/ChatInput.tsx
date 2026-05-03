"use client";

import { useCallback, useEffect, useRef, useState, KeyboardEvent } from "react";
import { Loader2, LoaderCircle } from "lucide-react";
import { SpriteIcon } from "@/components/ui/sprite-icon";
import ReplySuggestionsBar from "./ReplySuggestionsBar";
import { SttRecorder } from "@/lib/voice/stt-recorder";
import type { ReplySuggestion } from "@/lib/api";
import { toast } from "sonner";

// Canvas waveform configuration (from example/app VoiceInput)
const WAVEFORM_CONFIG = {
    lineThickness: 2,
    lineGap: 1.5,
    lineColor: "#000",
    speedFactor: 3,
    minHeight: 3,
    sensitivity: 2.5,
};

type InputAreaState = "default" | "recording" | "transcribing";
export type VoiceButtonState = "idle" | "connecting" | "active_ready" | "active_user_speaking";
export type MicCaptureState = "hidden" | "mic_hot" | "mic_cold";

interface ChatInputProps {
    onSend: (message: string) => void;
    disabled?: boolean;
    disabledReason?: string | null;
    roleName?: string;
    replySuggestions?: ReplySuggestion[] | null;
    onSelectSuggestion?: (text: string) => void;
    // Phase 2
    onMicStart?: () => void;
    onMicCancel?: () => void;
    // Streaming interrupt
    isStreaming?: boolean;
    onInterrupt?: () => void;
    voiceButtonState?: VoiceButtonState;
    micCaptureState?: MicCaptureState;
    onStartRealtimeVoice?: () => void;
    onCancelRealtimeVoiceStart?: () => void;
    onStopRealtimeVoice?: () => void;
    onToggleMicCapture?: () => void;
    getRealtimeMicAnalyserNode?: () => AnalyserNode | null;
}

export default function ChatInput({
    onSend,
    disabled = false,
    disabledReason,
    roleName,
    replySuggestions,
    onSelectSuggestion,
    onMicStart,
    onMicCancel,
    isStreaming = false,
    onInterrupt,
    voiceButtonState = "idle",
    micCaptureState = "hidden",
    onStartRealtimeVoice,
    onCancelRealtimeVoiceStart,
    onStopRealtimeVoice,
    onToggleMicCapture,
    getRealtimeMicAnalyserNode,
}: ChatInputProps) {
    const editorRef = useRef<HTMLDivElement>(null);
    const savedSelectionRef = useRef<Range | null>(null);
    const [message, setMessage] = useState("");
    const [pendingTranscript, setPendingTranscript] = useState<string | null>(null);

    // Phase 2: recording state
    const [inputAreaState, setInputAreaState] = useState<InputAreaState>("default");
    const sttRecorderRef = useRef<SttRecorder | null>(null);

    // Canvas waveform refs
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const waveformContainerRef = useRef<HTMLDivElement>(null);
    const frameCounterRef = useRef(0);
    const dataArrayRef = useRef<number[]>([]);
    const animationFrameRef = useRef<number | null>(null);
    const maxBarsRef = useRef(0);

    const placeholder = disabledReason?.trim()
        ? disabledReason.trim()
        : roleName?.trim()
        ? `Chat with ${roleName.trim()}`
        : "Chat with RoleName";

    const setEditorEmptyState = useCallback((isEmpty: boolean) => {
        const root = editorRef.current;
        if (!root) return;

        root.dataset.placeholder = placeholder;
        root.classList.toggle("is-empty", isEmpty);

        if (isEmpty) {
            savedSelectionRef.current = null;
        }
    }, [placeholder]);

    const clearEditor = useCallback(() => {
        const root = editorRef.current;
        if (!root) return;

        root.innerHTML = "";
        setEditorEmptyState(true);
    }, [setEditorEmptyState]);

    const getEditorText = useCallback(() => {
        const raw = editorRef.current?.innerText || "";
        return raw.replace(/\u00A0/g, " ");
    }, []);

    const isSelectionInsideEditor = useCallback((range: Range) => {
        const root = editorRef.current;
        if (!root) return false;

        return root.contains(range.commonAncestorContainer);
    }, []);

    const captureEditorSelection = useCallback(() => {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;

        const range = selection.getRangeAt(0);
        if (!isSelectionInsideEditor(range)) return;

        savedSelectionRef.current = range.cloneRange();
    }, [isSelectionInsideEditor]);

    const moveCaretToEnd = useCallback(() => {
        const root = editorRef.current;
        if (!root || !root.lastChild) return;

        const selection = window.getSelection();
        if (!selection) return;

        const range = document.createRange();
        range.selectNodeContents(root.lastChild);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
        savedSelectionRef.current = range.cloneRange();
    }, []);

    const handleSend = () => {
        const content = getEditorText().trim();
        if (!content || disabled) return;
        onSend(content);
        setMessage("");
        clearEditor();
    };

    useEffect(() => {
        clearEditor();
    }, [clearEditor]);

    useEffect(() => {
        const handleSelectionChange = () => {
            if (inputAreaState !== "default") return;
            captureEditorSelection();
        };

        document.addEventListener("selectionchange", handleSelectionChange);
        return () => document.removeEventListener("selectionchange", handleSelectionChange);
    }, [captureEditorSelection, inputAreaState]);

    const handleEditorInput = () => {
        const root = editorRef.current;
        if (!root) return;

        const value = getEditorText();
        const trimmed = value.trim();
        setMessage(trimmed);

        if (!trimmed) {
            root.innerHTML = "";
            setEditorEmptyState(true);
            return;
        }

        setEditorEmptyState(false);
    };

    const handleEditorKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    // ── Phase 2: Waveform Canvas helpers ──

    const initCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        const container = waveformContainerRef.current;
        if (!canvas || !container) return;

        const dpr = window.devicePixelRatio || 1;
        const rect = container.getBoundingClientRect();

        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;

        const ctx = canvas.getContext("2d");
        if (ctx) {
            ctx.scale(dpr, dpr);
        }

        maxBarsRef.current = Math.ceil(
            rect.width / (WAVEFORM_CONFIG.lineThickness + WAVEFORM_CONFIG.lineGap)
        );
    }, []);

    const renderWaveform = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        const width = canvas.width / dpr;
        const height = canvas.height / dpr;
        const centerY = height / 2;

        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = WAVEFORM_CONFIG.lineColor;

        const step = WAVEFORM_CONFIG.lineThickness + WAVEFORM_CONFIG.lineGap;
        const data = dataArrayRef.current;

        for (let i = 0; i < data.length; i++) {
            const h = data[i];
            const offsetFromRight = (data.length - 1 - i) * step;
            const x = width - offsetFromRight - WAVEFORM_CONFIG.lineThickness - 2;

            ctx.beginPath();
            // roundRect for rounded bars
            const rx = WAVEFORM_CONFIG.lineThickness / 2;
            const y = centerY - h / 2;
            if (typeof ctx.roundRect === "function") {
                ctx.roundRect(x, y, WAVEFORM_CONFIG.lineThickness, h, rx);
            } else {
                ctx.rect(x, y, WAVEFORM_CONFIG.lineThickness, h);
            }
            ctx.fill();
        }
    }, []);

    const waveformLoop = useCallback(() => {
        animationFrameRef.current = requestAnimationFrame(waveformLoop);

        // Speed throttle
        frameCounterRef.current++;
        if (frameCounterRef.current < WAVEFORM_CONFIG.speedFactor) return;
        frameCounterRef.current = 0;

        const analyser = sttRecorderRef.current?.getAnalyserNode();
        if (!analyser) return;

        const bufferLength = analyser.frequencyBinCount;
        const rawData = new Uint8Array(bufferLength);
        analyser.getByteTimeDomainData(rawData);

        // Calculate RMS
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
            const x = (rawData[i] - 128) / 128.0;
            sum += x * x;
        }
        const rms = Math.sqrt(sum / bufferLength);

        const canvas = canvasRef.current;
        if (!canvas) return;

        const dpr = window.devicePixelRatio || 1;
        const canvasHeight = canvas.height / dpr;
        let barHeight = rms * canvasHeight * WAVEFORM_CONFIG.sensitivity;
        barHeight = Math.min(
            canvasHeight * 0.9,
            Math.max(WAVEFORM_CONFIG.minHeight, barHeight)
        );

        dataArrayRef.current.push(barHeight);
        if (dataArrayRef.current.length > maxBarsRef.current) {
            dataArrayRef.current.shift();
        }

        renderWaveform();
    }, [renderWaveform]);

    // Start/stop waveform animation based on recording state
    useEffect(() => {
        if (inputAreaState === "recording") {
            dataArrayRef.current = [];
            frameCounterRef.current = 0;
            initCanvas();
            // Small delay so canvas is ready
            const raf = requestAnimationFrame(waveformLoop);
            animationFrameRef.current = raf;
        } else {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
                animationFrameRef.current = null;
            }
            // Clear canvas
            const canvas = canvasRef.current;
            if (canvas) {
                const ctx = canvas.getContext("2d");
                if (ctx) {
                    const dpr = window.devicePixelRatio || 1;
                    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
                }
            }
            dataArrayRef.current = [];
        }

        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
                animationFrameRef.current = null;
            }
        };
    }, [inputAreaState, initCanvas, waveformLoop]);

    // Handle window resize during recording
    useEffect(() => {
        const handleResize = () => {
            if (inputAreaState === "recording") {
                initCanvas();
            }
        };
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, [inputAreaState, initCanvas]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            sttRecorderRef.current?.dispose();
        };
    }, []);

    // ── Phase 2: Mic handlers ──

    const handleMicClick = async () => {
        if (inputAreaState !== "default") return;

        // Create recorder if needed
        if (!sttRecorderRef.current) {
            sttRecorderRef.current = new SttRecorder();
        }

        try {
            captureEditorSelection();
            await sttRecorderRef.current.startRecording();
            // Recording has actually started, now notify parent to interrupt TTS.
            onMicStart?.();
            setInputAreaState("recording");
        } catch (err) {
            const errorCode = err instanceof Error ? err.message : "MIC_START_FAILED";
            if (errorCode === "MIC_PERMISSION_DENIED") {
                // Always try getUserMedia first. Only after failure decide whether
                // it is a persistent deny (needs settings) or a regular prompt deny.
                const permissionState = await SttRecorder.getMicPermissionState();
                if (permissionState === "denied") {
                    toast("请在浏览器或系统设置中允许使用麦克风");
                } else {
                    toast("请允许麦克风权限以开始录音");
                }
                return;
            }

            switch (errorCode) {
                case "MIC_INSECURE_CONTEXT":
                case "MIC_API_UNAVAILABLE":
                    toast("请在 https 或 localhost 环境下使用麦克风");
                    break;
                case "MIC_DEVICE_NOT_FOUND":
                    toast("未检测到可用麦克风");
                    break;
                case "MIC_DEVICE_BUSY":
                    toast("麦克风正被其他应用占用");
                    break;
                default:
                    toast("无法启动录音");
            }
        }
    };

    const handleRecordConfirm = async () => {
        if (inputAreaState !== "recording" || !sttRecorderRef.current) return;

        setInputAreaState("transcribing");

        try {
            const text = await sttRecorderRef.current.confirmAndTranscribe();
            // Input area is still not in default state here; defer append until editor remounts.
            setPendingTranscript(text);
            setInputAreaState("default");
            onMicCancel?.(); // notify parent recording ended
        } catch (err) {
            if (err instanceof Error && err.message === "NO_SPEECH") {
                toast("似乎没有听到声音哦");
            } else {
                toast("转写失败，请重试");
            }
            setInputAreaState("default");
            onMicCancel?.();
        }
    };

    const handleRecordCancel = () => {
        sttRecorderRef.current?.cancelRecording();
        setInputAreaState("default");
        onMicCancel?.();
    };

    const appendTextToEditor = useCallback((text: string) => {
        const root = editorRef.current;
        if (!root) return;

        const selection = window.getSelection();
        let activeRange =
            savedSelectionRef.current && isSelectionInsideEditor(savedSelectionRef.current)
                ? savedSelectionRef.current.cloneRange()
                : selection && selection.rangeCount > 0 && isSelectionInsideEditor(selection.getRangeAt(0))
                ? selection.getRangeAt(0).cloneRange()
                : null;

        if (!activeRange) {
            activeRange = document.createRange();
            activeRange.selectNodeContents(root);
            activeRange.collapse(false);
        }

        if (selection) {
            selection.removeAllRanges();
            selection.addRange(activeRange);
        }

        activeRange.deleteContents();
        const textNode = document.createTextNode(text);
        activeRange.insertNode(textNode);
        activeRange.setStartAfter(textNode);
        activeRange.setEndAfter(textNode);
        selection?.removeAllRanges();
        selection?.addRange(activeRange);
        savedSelectionRef.current = activeRange.cloneRange();

        // Update state
        const updatedText = getEditorText().trim();
        setMessage(updatedText);
        setEditorEmptyState(updatedText.length === 0);
        root.focus();
        if (updatedText.length === 0) {
            moveCaretToEnd();
        }
    }, [getEditorText, isSelectionInsideEditor, moveCaretToEnd, setEditorEmptyState]);

    useEffect(() => {
        if (inputAreaState !== "default") return;
        if (!pendingTranscript) return;
        appendTextToEditor(pendingTranscript);
        setPendingTranscript(null);
    }, [appendTextToEditor, inputAreaState, pendingTranscript]);

    const hasText = message.length > 0;
    const isInRecordingFlow = inputAreaState === "recording" || inputAreaState === "transcribing";
    const isVoiceConnecting = voiceButtonState === "connecting";
    const isVoiceActive =
        voiceButtonState === "active_ready" || voiceButtonState === "active_user_speaking";
    const showVoiceWave = voiceButtonState === "active_user_speaking";
    const showMicCaptureButton = micCaptureState !== "hidden";
    const isMicCaptureEnabled = micCaptureState === "mic_hot";

    const handleVoiceButtonClick = useCallback(() => {
        if (disabled || isInRecordingFlow) return;

        if (voiceButtonState === "connecting") {
            onCancelRealtimeVoiceStart?.();
            return;
        }

        if (isVoiceActive) {
            onStopRealtimeVoice?.();
            return;
        }

        onStartRealtimeVoice?.();
    }, [
        disabled,
        isInRecordingFlow,
        isVoiceActive,
        onCancelRealtimeVoiceStart,
        onStartRealtimeVoice,
        onStopRealtimeVoice,
        voiceButtonState,
    ]);

    return (
        <div
            className="text-base mx-auto [--thread-content-margin:--spacing(4)] @w-sm/main:[--thread-content-margin:--spacing(6)] @w-lg/main:[--thread-content-margin:--spacing(16)] px-(--thread-content-margin)"
            style={{ backgroundColor: "var(--workspace-bg)" }}
        >
            <div
                className="[--thread-content-max-width:40rem] @w-lg/main:[--thread-content-max-width:48rem] mx-auto max-w-(--thread-content-max-width) flex-1 mb-4"
                style={{ maxWidth: "48rem", width: "100%" }}
            >
                <div className="flex justify-center empty:hidden">
                </div>
                {disabledReason ? (
                    <div className="mb-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                        {disabledReason}
                    </div>
                ) : null}
                <div className="pointer-events-auto relative z-1 flex h-(--composer-container-height,100%) max-w-full flex-(--composer-container-flex,1) flex-col">
                    <div className="absolute start-0 end-0 bottom-full z-20">
                        {replySuggestions && replySuggestions.length > 0 && (
                            <ReplySuggestionsBar
                                suggestions={replySuggestions}
                                onSelect={(text) => {
                                    appendTextToEditor(text);
                                    onSelectSuggestion?.(text);
                                }}
                            />
                        )}
                    </div>
                    <form
                        className="group/composer w-full"
                        data-type="unified-composer"
                        style={{ viewTransitionName: "var(--vt-composer)" }}
                        onSubmit={(e) => {
                            e.preventDefault();
                            handleSend();
                        }}
                    >
                        <div className="hidden">
                            <input
                                multiple
                                tabIndex={-1}
                                type="file"
                                style={{
                                    border: "0px",
                                    clip: "rect(0px, 0px, 0px, 0px)",
                                    clipPath: "inset(50%)",
                                    height: "1px",
                                    margin: "0px -1px -1px 0px",
                                    overflow: "hidden",
                                    padding: "0px",
                                    position: "absolute",
                                    width: "1px",
                                    whiteSpace: "nowrap",
                                }}
                            />
                        </div>
                        <div className="">
                            <div
                                className={`bg-token-bg-primary corner-superellipse/1.1 overflow-clip bg-clip-padding p-2.5 contain-inline-size motion-safe:transition-colors motion-safe:duration-200 motion-safe:ease-in-out dark:bg-[#303030] grid grid-cols-[auto_1fr_auto] [grid-template-areas:'header_header_header'_'leading_primary_trailing'_'._footer_.'] group-data-expanded/composer:[grid-template-areas:'header_header_header'_'primary_primary_primary'_'leading_footer_trailing'] shadow-short ${isInRecordingFlow ? "ring-2 ring-blue-100" : ""}`}
                                data-composer-surface="true"
                                style={{
                                    borderRadius: "28px",
                                    transform: "none",
                                    transformOrigin: "50% 50% 0px",
                                }}
                                onClick={() => {
                                    if (inputAreaState === "default") {
                                        editorRef.current?.focus();
                                    }
                                }}
                            >
                                {/* ── Primary area: text input OR waveform OR transcribing ── */}
                                <div
                                    className={`-my-2.5 relative flex min-h-14 overflow-x-hidden px-1.5 [grid-area:primary] group-data-expanded/composer:mb-0 group-data-expanded/composer:px-2.5 ${isInRecordingFlow ? "[grid-column:1/-1] items-center" : "items-end"} cursor-text`}
                                    style={{ transform: "none", transformOrigin: "50% 50% 0px" }}
                                >
                                    <div
                                        className={`wcDTda_prosemirror-parent text-token-text-primary max-h-[max(30svh,5rem)] max-h-52 min-h-[var(--deep-research-composer-extra-height,unset)] flex-1 overflow-y-auto default-browser vertical-scroll-fade-mask w-full flex flex-col-reverse ${isInRecordingFlow ? "pointer-events-none opacity-0" : ""}`}
                                        aria-hidden={isInRecordingFlow}
                                    >
                                        <textarea
                                            className="wcDTda_fallbackTextarea"
                                            name="prompt-textarea"
                                            placeholder={placeholder}
                                            data-virtualkeyboard="true"
                                            style={{ display: "none" }}
                                            readOnly
                                        />
                                        <div
                                            contentEditable={!disabled && inputAreaState === "default"}
                                            translate="no"
                                            className="ProseMirror w-full"
                                            id="prompt-textarea"
                                            data-virtualkeyboard="true"
                                            ref={editorRef}
                                            onInput={handleEditorInput}
                                            onKeyDown={handleEditorKeyDown}
                                            suppressContentEditableWarning
                                        />
                                    </div>

                                    {inputAreaState === "recording" && (
                                        <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-1.5">
                                            <div
                                                ref={waveformContainerRef}
                                                className="recording-waveform-container w-full"
                                                style={{ maxWidth: "min(42rem, calc(100% - 9rem))" }}
                                            >
                                                <canvas
                                                    ref={canvasRef}
                                                    className="recording-waveform-canvas"
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {inputAreaState === "transcribing" && (
                                        <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-1.5">
                                            <div className="flex items-center gap-2 px-1">
                                                <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                                                <span className="text-token-text-secondary text-sm">
                                                    正在转写文字...
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* ── Leading area: plus button (hidden during recording) ── */}
                                <div
                                    className="[grid-area:leading] self-end"
                                    style={{ transform: "none", transformOrigin: "50% 50% 0px" }}
                                >
                                    {inputAreaState === "default" && (
                                        <span className="flex" data-state="closed">
                                            <button
                                                type="button"
                                                className="composer-btn"
                                                data-testid="composer-plus-btn"
                                                aria-label="Add files and more"
                                                id="composer-plus-btn"
                                                aria-haspopup="menu"
                                                aria-expanded="false"
                                                data-state="closed"
                                                onClick={() => toast("功能开发中")}
                                            >
                                                <SpriteIcon name="desktop" size={20} />
                                            </button>
                                        </span>
                                    )}
                                </div>

                                {/* ── Trailing area: mic/send OR cancel/confirm ── */}
                                <div
                                    className={`${isInRecordingFlow ? "absolute right-2.5 bottom-2.5 z-20 flex items-center gap-2" : "flex items-end gap-2 [grid-area:trailing]"}`}
                                    style={{ transform: "none", transformOrigin: "50% 50% 0px" }}
                                >
                                    <div className="ms-auto flex items-center gap-1.5">
                                        {inputAreaState === "default" && (
                                            <>
                                                {!isVoiceConnecting && !isVoiceActive && (
                                                    <span data-state="closed">
                                                        <button
                                                            aria-label="语音输入"
                                                            type="button"
                                                            className="composer-btn"
                                                            onClick={handleMicClick}
                                                            disabled={disabled}
                                                        >
                                                            <SpriteIcon name="close" size={20} />
                                                        </button>
                                                    </span>
                                                )}

                                                {showMicCaptureButton && (
                                                    <button
                                                        type="button"
                                                        aria-label={isMicCaptureEnabled ? "关闭收音" : "打开收音"}
                                                        aria-pressed={isMicCaptureEnabled}
                                                        className={`composer-btn relative transition-colors focus-visible:outline-black focus-visible:outline-none dark:focus-visible:outline-white ${
                                                            isMicCaptureEnabled
                                                                ? "text-token-text-primary"
                                                                : "text-token-text-secondary"
                                                        }`}
                                                        onClick={onToggleMicCapture}
                                                    >
                                                        <MicCaptureStatusGlyph muted={!isMicCaptureEnabled} />
                                                    </button>
                                                )}

                                                {/* Send button / Pause button */}
                                                <div>
                                                    <span className="" data-state="closed">
                                                        <div>
                                                            <div className="relative">
                                                                {isStreaming ? (
                                                                    <button
                                                                        type="button"
                                                                        aria-label="暂停生成"
                                                                        className="composer-submit-button-color flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:opacity-70 focus-visible:outline-black focus-visible:outline-none dark:focus-visible:outline-white"
                                                                        onClick={onInterrupt}
                                                                    >
                                                                        <span className="bg-white rounded-[3px]" style={{ width: '16px', height: '16px' }} />
                                                                    </button>
                                                                ) : (
                                                                    <button
                                                                        type="button"
                                                                        aria-label={
                                                                            hasText
                                                                                ? "发送消息"
                                                                                : voiceButtonState === "connecting"
                                                                                ? "取消语音连接"
                                                                                : isVoiceActive
                                                                                ? "退出语音模式"
                                                                                : "进入语音模式"
                                                                        }
                                                                        className={`composer-submit-button-color text-submit-btn-text flex h-9 shrink-0 items-center overflow-hidden rounded-full transition-[width,padding,opacity] duration-200 ease-out hover:opacity-70 focus-visible:outline-black focus-visible:outline-none disabled:text-[#f4f4f4] disabled:opacity-30 dark:focus-visible:outline-white ${
                                                                            isVoiceConnecting
                                                                                ? "w-[6rem] justify-center px-3"
                                                                                : "w-9 justify-center px-0"
                                                                        }`}
                                                                        style={{
                                                                            viewTransitionName:
                                                                                "var(--vt-composer-speech-button)",
                                                                            transformOrigin: "right center",
                                                                        }}
                                                                        disabled={
                                                                            isInRecordingFlow ||
                                                                            (disabled &&
                                                                                !hasText &&
                                                                                !isVoiceActive &&
                                                                                !isVoiceConnecting) ||
                                                                            (disabled && hasText)
                                                                        }
                                                                        onClick={() => {
                                                                            if (!hasText) {
                                                                                handleVoiceButtonClick();
                                                                                return;
                                                                            }
                                                                            handleSend();
                                                                        }}
                                                                    >
                                                                        {hasText ? (
                                                                            <SpriteIcon name="laptop" size={20} className="brightness-0 invert" />
                                                                        ) : isVoiceConnecting ? (
                                                                            <span className="flex items-center gap-2 whitespace-nowrap">
                                                                                <LoaderCircle className="h-4 w-4 shrink-0 animate-spin" />
                                                                                <span className="text-[13px] font-medium tracking-[0.01em]">
                                                                                    Cancel
                                                                                </span>
                                                                            </span>
                                                                        ) : showVoiceWave ? (
                                                                            <VoiceSpeakingGlyph
                                                                                getAnalyserNode={getRealtimeMicAnalyserNode}
                                                                            />
                                                                        ) : isVoiceActive ? (
                                                                            <SpriteIcon name="hangup" size={24} className="h-6 w-6" />
                                                                        ) : (
                                                                            <SpriteIcon name="sliders" size={20} className="brightness-0 invert" />
                                                                        )}
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </span>
                                                </div>
                                            </>
                                        )}

                                        {(inputAreaState === "recording" || inputAreaState === "transcribing") && (
                                            <>
                                                {/* Cancel (×) button */}
                                                <button
                                                    type="button"
                                                    className="composer-btn"
                                                    onClick={handleRecordCancel}
                                                    disabled={inputAreaState === "transcribing"}
                                                    aria-label="取消录音"
                                                >
                                                    <span className="text-token-text-secondary flex items-center justify-center">
                                                        <SpriteIcon name="close-recording" size={20} />
                                                    </span>
                                                </button>

                                                {/* Confirm (✓) button */}
                                                <button
                                                    type="button"
                                                    className="composer-submit-button-color text-submit-btn-text flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:opacity-70 focus-visible:outline-none disabled:opacity-30"
                                                    onClick={handleRecordConfirm}
                                                    disabled={inputAreaState === "transcribing"}
                                                    aria-label="确认录音"
                                                >
                                                    <span className="text-white flex items-center justify-center">
                                                        <SpriteIcon name="check-recording" size={20} className="brightness-0 invert" />
                                                    </span>
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </form>
                </div>
                <input
                    className="sr-only select-none"
                    tabIndex={-1}
                    aria-hidden="true"
                    id="upload-photos"
                    accept="image/*"
                    multiple
                    type="file"
                />
                <input
                    className="sr-only select-none"
                    tabIndex={-1}
                    aria-hidden="true"
                    id="upload-camera"
                    accept="image/*"
                    capture="environment"
                    multiple
                    type="file"
                />
            </div>
        </div>
    );
}

const SPEAKING_CAPSULE_BASE_LEVELS = [0.24, 0.52, 0.4, 0.3] as const;
const SPEAKING_CAPSULE_WIDTHS = [3, 3, 4, 3] as const;
const SPEAKING_CAPSULE_MIN_HEIGHTS = [4, 4.5, 5, 4.25] as const;
const SPEAKING_CAPSULE_TRAVEL = [6, 7.5, 7.5, 6] as const;

function VoiceSpeakingGlyph({
    getAnalyserNode,
}: {
    getAnalyserNode?: () => AnalyserNode | null;
}) {
    const [levels, setLevels] = useState<number[]>(() => [...SPEAKING_CAPSULE_BASE_LEVELS]);
    const levelsRef = useRef<number[]>([...SPEAKING_CAPSULE_BASE_LEVELS]);

    useEffect(() => {
        levelsRef.current = levels;
    }, [levels]);

    useEffect(() => {
        let frameId = 0;

        const tick = () => {
            const analyser = getAnalyserNode?.() ?? null;
            if (!analyser) {
                frameId = requestAnimationFrame(tick);
                return;
            }

            const frequencyData = new Uint8Array(analyser.frequencyBinCount);
            analyser.getByteFrequencyData(frequencyData);

            const relevantBinCount = Math.min(24, frequencyData.length);
            const binsPerCapsule = Math.max(1, Math.floor(relevantBinCount / 4));

            const nextLevels = SPEAKING_CAPSULE_BASE_LEVELS.map((baseLevel, index) => {
                const start = index * binsPerCapsule;
                const end =
                    index === SPEAKING_CAPSULE_BASE_LEVELS.length - 1
                        ? relevantBinCount
                        : Math.min(relevantBinCount, start + binsPerCapsule);

                let sum = 0;
                for (let cursor = start; cursor < end; cursor += 1) {
                    sum += frequencyData[cursor] / 255;
                }

                const average = end > start ? sum / (end - start) : 0;
                const scaled = Math.max(baseLevel * 0.8, Math.min(1, average * 2.15));
                const previous = levelsRef.current[index] ?? baseLevel;
                const eased =
                    scaled >= previous
                        ? previous + (scaled - previous) * 0.3
                        : previous + (scaled - previous) * 0.16;

                return eased;
            });

            setLevels(nextLevels);
            frameId = requestAnimationFrame(tick);
        };

        frameId = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frameId);
    }, [getAnalyserNode]);

    return (
        <span className="flex h-4 items-center justify-center gap-[2px]" aria-hidden="true">
            {levels.map((level, index) => (
                <div
                    key={index}
                    className="shrink-0"
                    style={{
                        width: SPEAKING_CAPSULE_WIDTHS[index],
                        height: SPEAKING_CAPSULE_MIN_HEIGHTS[index] + level * SPEAKING_CAPSULE_TRAVEL[index],
                        display: "block",
                        backgroundColor: "rgba(255, 255, 255, 0.92)",
                        borderRadius: 999,
                        boxShadow: "0 0 6px rgba(255, 255, 255, 0.14)",
                        opacity: 0.85 + level * 0.15,
                        transform: `translateY(${(1 - level) * 0.55}px)`,
                    }}
                />
            ))}
        </span>
    );
}

function MicCaptureStatusGlyph({ muted }: { muted: boolean }) {
    return (
        <span className="relative flex h-5 w-5 items-center justify-center" aria-hidden="true">
            <SpriteIcon name="close" size={20} className="h-5 w-5" />
            {muted ? (
                <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <span className="h-px w-5 rotate-[45deg] rounded-full bg-current" />
                </span>
            ) : null}
        </span>
    );
}
