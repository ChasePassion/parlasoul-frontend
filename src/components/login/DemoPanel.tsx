"use client";

/**
 * 登录页的左右分栏。
 *
 * 左侧演示单独渲染在 /login/demo 路由里，用同源 iframe 嵌进来：
 * 演示会驱动真实业务组件（输入框 focus、Radix 菜单 Portal、全局 Selection），
 * 这些操作都发生在 iframe 自己的 document 里，不会影响右栏表单的焦点和输入法。
 */
export default function DemoPanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:h-screen lg:overflow-hidden lg:grid-cols-[minmax(0,1fr)_28rem]">
      <section className="relative hidden min-h-0 overflow-hidden border-r border-border bg-white lg:flex lg:flex-col">
        <iframe
          src="/login/demo"
          title="ParlaSoul 产品演示"
          tabIndex={-1}
          aria-hidden
          className="h-full w-full flex-1 border-0 bg-white"
          style={{ pointerEvents: "none" }}
        />
      </section>

      {children}
    </div>
  );
}
