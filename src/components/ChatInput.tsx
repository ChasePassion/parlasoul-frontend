"use client";

import { useCallback, useEffect, useRef, useState, KeyboardEvent } from "react";
import Image from "next/image";
import ReplySuggestionsBar from "./ReplySuggestionsBar";
import { SttRecorder } from "@/lib/voice/stt-recorder";
import type { ReplySuggestion } from "@/lib/api";

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
}: ChatInputProps) {
    const editorRef = useRef<HTMLDivElement>(null);
    const savedSelectionRef = useRef<Range | null>(null);
    const [message, setMessage] = useState("");
    const [notice, setNotice] = useState<string | null>(null);
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

    const showNotice = (text: string) => {
        setNotice(text);
    };

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

    useEffect(() => {
        if (!notice) return;
        const timer = setTimeout(() => setNotice(null), 1600);
        return () => clearTimeout(timer);
    }, [notice]);

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
                    showNotice("请在浏览器或系统设置中允许使用麦克风");
                } else {
                    showNotice("请允许麦克风权限以开始录音");
                }
                return;
            }

            switch (errorCode) {
                case "MIC_INSECURE_CONTEXT":
                case "MIC_API_UNAVAILABLE":
                    showNotice("请在 https 或 localhost 环境下使用麦克风");
                    break;
                case "MIC_DEVICE_NOT_FOUND":
                    showNotice("未检测到可用麦克风");
                    break;
                case "MIC_DEVICE_BUSY":
                    showNotice("麦克风正被其他应用占用");
                    break;
                default:
                    showNotice("无法启动录音");
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
                showNotice("似乎没有听到声音哦");
            } else {
                showNotice("转写失败，请重试");
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
                    {notice ? (
                        <div className="rounded-full bg-black/80 px-3 py-1 text-xs text-white">{notice}</div>
                    ) : null}
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
                                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-500" />
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
                                                onClick={() => showNotice("功能开发中")}
                                            >
                                                <Image
                                                    src="/icons/desktop-6be74c.svg"
                                                    width="20"
                                                    height="20"
                                                    aria-hidden="true"
                                                    className="icon"
                                                    alt=""
                                                />
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
                                                {/* Mic button */}
                                                <span data-state="closed">
                                                    <button
                                                        aria-label="语音输入"
                                                        type="button"
                                                        className="composer-btn"
                                                        onClick={handleMicClick}
                                                        disabled={disabled}
                                                    >
                                                        <Image
                                                            src="/icons/close-29f921.svg"
                                                            width="20"
                                                            height="20"
                                                            aria-label=""
                                                            className="icon"
                                                            alt=""
                                                        />
                                                    </button>
                                                </span>

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
                                                                        aria-label={hasText ? "Send message" : "Start Voice"}
                                                                        className="composer-submit-button-color text-submit-btn-text flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:opacity-70 focus-visible:outline-black focus-visible:outline-none disabled:text-[#f4f4f4] disabled:opacity-30 dark:focus-visible:outline-white"
                                                                        style={{
                                                                            viewTransitionName:
                                                                                "var(--vt-composer-speech-button)",
                                                                        }}
                                                                        disabled={disabled}
                                                                        onClick={() => {
                                                                            if (!hasText) {
                                                                                showNotice("功能开发中");
                                                                                return;
                                                                            }
                                                                            handleSend();
                                                                        }}
                                                                    >
                                                                        <Image
                                                                            src={
                                                                                hasText
                                                                                    ? "/icons/laptop-01bab7.svg"
                                                                                    : "/icons/sliders-f8aa74.svg"
                                                                            }
                                                                            width="20"
                                                                            height="20"
                                                                            aria-hidden="true"
                                                                            className="h-5 w-5 brightness-0 invert"
                                                                            alt=""
                                                                        />
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
                                                        <Image
                                                            src="/icons/close-recording-85f94b.svg"
                                                            width={20}
                                                            height={20}
                                                            alt=""
                                                            className="icon"
                                                        />
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
                                                        <Image
                                                            src="/icons/check-recording-fa1dbd.svg"
                                                            width={20}
                                                            height={20}
                                                            alt=""
                                                            className="h-5 w-5 brightness-0 invert"
                                                        />
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
