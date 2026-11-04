"use client";

import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

type MarkdownVariant = "assistant" | "user";

export default function Markdown({
    content,
    variant = "assistant",
}: {
    content: string;
    variant?: MarkdownVariant;
}) {
    const isUser = variant === "user";

    const components: Components = {
        p: ({ children }) => (
            <p className="mb-2 last:mb-0 whitespace-pre-wrap">{children}</p>
        ),
        a: ({ href, children }) => (
            <a
                href={href}
                target="_blank"
                rel="noreferrer"
                className={[
                    "underline break-words",
                    isUser
                        ? "text-white/90 hover:text-white"
                        : "text-blue-700 hover:text-blue-900",
                ].join(" ")}
            >
                {children}
            </a>
        ),
        ul: ({ children }) => (
            <ul className="mb-2 list-disc pl-5 space-y-1">{children}</ul>
        ),
        ol: ({ children }) => (
            <ol className="mb-2 list-decimal pl-5 space-y-1">{children}</ol>
        ),
        li: ({ children }) => <li className="leading-normal">{children}</li>,
        blockquote: ({ children }) => (
            <blockquote
                className={[
                    "mb-2 border-l-4 pl-3 italic",
                    isUser ? "border-white/30 text-white/90" : "border-gray-200 text-gray-700",
                ].join(" ")}
            >
                {children}
            </blockquote>
        ),
        h1: ({ children }) => (
            <h1 className="text-base font-semibold mb-2 mt-3 first:mt-0">{children}</h1>
        ),
        h2: ({ children }) => (
            <h2 className="text-sm font-semibold mb-2 mt-3 first:mt-0">{children}</h2>
        ),
        h3: ({ children }) => (
            <h3 className="text-sm font-medium mb-2 mt-3 first:mt-0">{children}</h3>
        ),
        pre: ({ children }) => (
            <pre
                className={[
                    "mb-2 overflow-x-auto rounded-lg p-3 text-xs leading-relaxed",
                    isUser ? "bg-white/15" : "bg-gray-50",
                ].join(" ")}
            >
                {children}
            </pre>
        ),
        code(props) {
            const { children, className, node, ...rest } = props;
            void node; // avoid passing `node` to DOM; keep lint happy
            const text = String(children ?? "");
            const isBlock = Boolean(className) || text.includes("\n");
            if (isBlock) {
                return (
                    <code {...rest} className="font-mono">
                        {text.replace(/\n$/, "")}
                    </code>
                );
            }
            return (
                <code
                    {...rest}
                    className={[
                        "rounded px-1 py-0.5 font-mono text-[0.85em]",
                        isUser ? "bg-white/15" : "bg-gray-100",
                    ].join(" ")}
                >
                    {children}
                </code>
            );
        },
        hr: () => (
            <hr className={["my-3", isUser ? "border-white/30" : "border-gray-200"].join(" ")} />
        ),
    };

    return (
        <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} components={components}>
            {content}
        </ReactMarkdown>
    );
}
