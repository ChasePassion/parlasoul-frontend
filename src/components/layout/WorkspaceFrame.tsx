"use client";

import { ReactNode } from "react";

interface WorkspaceFrameProps {
    header?: ReactNode;
    footer?: ReactNode;
    children: ReactNode;
    className?: string;
    mainClassName?: string;
}

export default function WorkspaceFrame({
    header,
    footer,
    children,
    className = "",
    mainClassName = "",
}: WorkspaceFrameProps) {
    return (
        <div className={`flex h-full min-h-0 flex-1 flex-col ${className}`}>
            {header ? <header className="flex-none">{header}</header> : null}
            <main className={`flex min-h-0 flex-1 flex-col ${mainClassName}`}>{children}</main>
            {footer ? <footer className="flex-none">{footer}</footer> : null}
        </div>
    );
}

