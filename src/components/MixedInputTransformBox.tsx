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
        <div className="mt-1 px-1 max-w-full">
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap wrap-break-word">
                {transformedContent}
                {isStreaming && (
                    <span className="inline-block w-0.5 h-4 bg-blue-400 ml-0.5 animate-pulse align-text-bottom" />
                )}
            </p>
        </div>
    );
}
