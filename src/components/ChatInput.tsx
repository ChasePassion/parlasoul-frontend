"use client";

import { useCallback, useEffect, useRef, useState, KeyboardEvent } from "react";
import Image from "next/image";
import ReplySuggestionsBar from "./ReplySuggestionsBar";
import type { ReplySuggestion } from "@/lib/api";

interface ChatInputProps {
    onSend: (message: string) => void;
    disabled?: boolean;
    roleName?: string;
    replySuggestions?: ReplySuggestion[] | null;
    onSelectSuggestion?: (text: string) => void;
}

export default function ChatInput({
    onSend,
    disabled = false,
    roleName,
    replySuggestions,
    onSelectSuggestion,
}: ChatInputProps) {
    const editorRef = useRef<HTMLDivElement>(null);
    const [message, setMessage] = useState("");
    const [notice, setNotice] = useState<string | null>(null);

    const placeholder = roleName?.trim()
        ? `Chat with ${roleName.trim()}`
        : "Chat with RoleName";

    const renderPlaceholder = useCallback(() => {
        const root = editorRef.current;
        if (!root) return;

        root.textContent = "";

        const paragraph = document.createElement("p");
        paragraph.className = "placeholder";
        paragraph.setAttribute("data-placeholder", placeholder);

        const trailingBreak = document.createElement("br");
        trailingBreak.className = "ProseMirror-trailingBreak";

        paragraph.appendChild(trailingBreak);
        root.appendChild(paragraph);
    }, [placeholder]);

    const getEditorText = () => {
        const raw = editorRef.current?.innerText || "";
        return raw.replace(/\u00A0/g, " ");
    };

    const showNotice = (text: string) => {
        setNotice(text);
    };

    const handleSend = () => {
        const content = getEditorText().trim();
        if (!content || disabled) return;
        onSend(content);
        setMessage("");
        renderPlaceholder();
    };

    useEffect(() => {
        renderPlaceholder();
    }, [renderPlaceholder]);

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
            renderPlaceholder();
            return;
        }

        const placeholderNode = root.querySelector("p.placeholder");
        if (placeholderNode) {
            placeholderNode.classList.remove("placeholder");
            placeholderNode.removeAttribute("data-placeholder");
        }
    };

    const handleEditorKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const hasText = message.length > 0;

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
                <div className="pointer-events-auto relative z-1 flex h-(--composer-container-height,100%) max-w-full flex-(--composer-container-flex,1) flex-col">
                    <div className="absolute start-0 end-0 bottom-full z-20">
                        {replySuggestions && replySuggestions.length > 0 && (
                            <ReplySuggestionsBar
                                suggestions={replySuggestions}
                                onSelect={(text) => {
                                    // Append suggestion text to editor
                                    const root = editorRef.current;
                                    if (!root) return;

                                    // Remove placeholder if present
                                    const placeholderNode = root.querySelector("p.placeholder");
                                    if (placeholderNode) {
                                        placeholderNode.classList.remove("placeholder");
                                        placeholderNode.removeAttribute("data-placeholder");
                                        placeholderNode.textContent = text;
                                    } else {
                                        // Append to existing content
                                        const currentText = getEditorText().trim();
                                        const newText = currentText ? `${currentText} ${text}` : text;
                                        root.textContent = "";
                                        const p = document.createElement("p");
                                        p.textContent = newText;
                                        root.appendChild(p);
                                    }

                                    // Update state
                                    const updatedText = getEditorText().trim();
                                    setMessage(updatedText);
                                    root.focus();

                                    // Place cursor at end
                                    const selection = window.getSelection();
                                    if (selection && root.lastChild) {
                                        const range = document.createRange();
                                        range.selectNodeContents(root.lastChild);
                                        range.collapse(false);
                                        selection.removeAllRanges();
                                        selection.addRange(range);
                                    }

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
                                className="bg-token-bg-primary corner-superellipse/1.1 overflow-clip bg-clip-padding p-2.5 contain-inline-size motion-safe:transition-colors motion-safe:duration-200 motion-safe:ease-in-out dark:bg-[#303030] grid grid-cols-[auto_1fr_auto] [grid-template-areas:'header_header_header'_'leading_primary_trailing'_'._footer_.'] group-data-expanded/composer:[grid-template-areas:'header_header_header'_'primary_primary_primary'_'leading_footer_trailing'] shadow-short"
                                data-composer-surface="true"
                                style={{
                                    borderRadius: "28px",
                                    transform: "none",
                                    transformOrigin: "50% 50% 0px",
                                }}
                                onClick={() => editorRef.current?.focus()}
                            >
                                <div
                                    className="-my-2.5 flex min-h-14 items-center overflow-x-hidden px-1.5 [grid-area:primary] group-data-expanded/composer:mb-0 group-data-expanded/composer:px-2.5 cursor-text"
                                    style={{ transform: "none", transformOrigin: "50% 50% 0px" }}
                                >
                                    <div className="wcDTda_prosemirror-parent text-token-text-primary max-h-[max(30svh,5rem)] max-h-52 min-h-[var(--deep-research-composer-extra-height,unset)] flex-1 overflow-auto [scrollbar-width:thin] default-browser vertical-scroll-fade-mask">
                                        <textarea
                                            className="wcDTda_fallbackTextarea"
                                            name="prompt-textarea"
                                            placeholder={placeholder}
                                            data-virtualkeyboard="true"
                                            style={{ display: "none" }}
                                            readOnly
                                        />
                                        <div
                                            contentEditable={!disabled}
                                            translate="no"
                                            className="ProseMirror"
                                            id="prompt-textarea"
                                            data-virtualkeyboard="true"
                                            ref={editorRef}
                                            onInput={handleEditorInput}
                                            onKeyDown={handleEditorKeyDown}
                                            suppressContentEditableWarning
                                        >
                                            <p data-placeholder={placeholder} className="placeholder">
                                                <br className="ProseMirror-trailingBreak" />
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                <div
                                    className="[grid-area:leading]"
                                    style={{ transform: "none", transformOrigin: "50% 50% 0px" }}
                                >
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
                                </div>
                                <div
                                    className="flex items-center gap-2 [grid-area:trailing]"
                                    style={{ transform: "none", transformOrigin: "50% 50% 0px" }}
                                >
                                    <div className="ms-auto flex items-center gap-1.5">
                                        <span className="" data-state="closed">
                                            <button
                                                aria-label="Dictate button"
                                                type="button"
                                                className="composer-btn"
                                                onClick={() => showNotice("功能开发中")}
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
                                        <div>
                                            <span className="" data-state="closed">
                                                <div>
                                                    <div className="relative">
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
                                                    </div>
                                                </div>
                                            </span>
                                        </div>
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
