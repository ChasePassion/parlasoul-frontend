"use client";

import { SpriteIcon } from "@/components/ui/sprite-icon";

/**
 * 加载态输入框：逐层复刻 ChatInput 的 DOM 与几何，但保持静态、不可交互。
 *
 * 不用 disabled 的真实 ChatInput：它的 placeholder 依赖 ProseMirror 的
 * `.is-empty::before` 伪元素，禁用时编辑器不初始化，文案会塌陷到底边。
 * 这里直接渲染文案并用 items-center 垂直居中；所有按钮带 disabled，
 * 走 globals.css 的 `.composer-btn:disabled { opacity: .3; cursor: not-allowed }`。
 */
export default function ChatComposerPlaceholder({
  roleName,
}: {
  roleName?: string;
}) {
  const placeholder = roleName?.trim()
    ? `Chat with ${roleName.trim()}`
    : "Chat with RoleName";

  return (
    <div
      className="text-base mx-auto [--thread-content-margin:--spacing(4)] @w-sm/main:[--thread-content-margin:--spacing(6)] @w-lg/main:[--thread-content-margin:--spacing(16)] px-(--thread-content-margin)"
      style={{ backgroundColor: "var(--workspace-bg)" }}
    >
      <div
        className="[--thread-content-max-width:40rem] @w-lg/main:[--thread-content-max-width:48rem] mx-auto max-w-(--thread-content-max-width) flex-1 mb-4"
        style={{ maxWidth: "48rem", width: "100%" }}
      >
        <form className="group/composer w-full" onSubmit={(e) => e.preventDefault()}>
          <div
            className="bg-token-bg-primary corner-superellipse/1.1 overflow-clip bg-clip-padding p-2.5 contain-inline-size grid grid-cols-[auto_1fr_auto] [grid-template-areas:'leading_primary_trailing'] shadow-short"
            style={{ borderRadius: "28px" }}
          >
            {/* Leading: plus button — disabled, not clickable */}
            <div className="[grid-area:leading] self-end">
              <button
                type="button"
                disabled
                className="composer-btn"
                aria-label="更多功能"
              >
                <SpriteIcon name="desktop" size={20} />
              </button>
            </div>

            {/* Primary: placeholder text, vertically centered */}
            <div className="-my-2.5 relative flex min-h-14 cursor-text items-center overflow-x-hidden px-1.5 [grid-area:primary]">
              <span className="truncate text-sm text-[#8f8f8f]">
                {placeholder}
              </span>
            </div>

            {/* Trailing: mic + send — both disabled */}
            <div className="flex items-end gap-2 [grid-area:trailing]">
              <div className="ms-auto flex items-center gap-1.5">
                <button
                  type="button"
                  disabled
                  className="composer-btn"
                  aria-label="语音输入"
                >
                  <SpriteIcon name="close" size={20} />
                </button>
                <button
                  type="button"
                  disabled
                  className="composer-submit-button-color text-submit-btn-text flex h-9 w-9 shrink-0 items-center justify-center rounded-full disabled:opacity-30"
                  aria-label="发送"
                >
                  <SpriteIcon name="play" size={20} className="brightness-0 invert" />
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
