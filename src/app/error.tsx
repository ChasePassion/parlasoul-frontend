"use client";

import { useEffect } from "react";

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Route rendering failed:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] w-full flex-col items-center justify-center bg-[var(--workspace-bg)] px-6 text-center">
      <h1 className="text-lg font-semibold text-[var(--text-primary)]">页面加载失败</h1>
      <p className="mt-2 text-sm text-[var(--text-secondary)]">请稍后重试，或返回上一页。</p>
      {error.digest ? (
        <p className="mt-1 text-xs text-[var(--text-tertiary)]">
          错误编号：{error.digest}
        </p>
      ) : null}
      <button
        type="button"
        onClick={reset}
        className="mt-6 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
      >
        重试
      </button>
    </div>
  );
}
