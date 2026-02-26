"use client";

interface MixedInputTransformBoxProps {
    transformedContent: string;
    isStreaming?: boolean;
}

export default function MixedInputTransformBox({
    transformedContent,
    isStreaming = false,
}: MixedInputTransformBoxProps) {
    if (!transformedContent) return null;

    return (
        <div className="bubble-translation mt-1.5 bg-white rounded-xl border border-gray-100 px-3 py-2 max-w-full">
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap wrap-break-word">
                {transformedContent}
                {isStreaming && (
                    <span className="inline-block w-0.5 h-4 bg-blue-400 ml-0.5 animate-pulse align-text-bottom" />
                )}
            </p>
        </div>
    );
}
