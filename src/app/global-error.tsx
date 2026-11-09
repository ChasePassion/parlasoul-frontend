"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="zh-CN">
      <body>
        <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6 text-center">
          <h1 className="text-lg font-semibold text-slate-900">应用出现异常</h1>
          <p className="mt-2 text-sm text-slate-600">请刷新页面重试。</p>
          {error.digest ? (
            <p className="mt-1 text-xs text-slate-400">错误编号：{error.digest}</p>
          ) : null}
          <button
            type="button"
            onClick={reset}
            className="mt-6 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            刷新页面
          </button>
        </div>
      </body>
    </html>
  );
}
