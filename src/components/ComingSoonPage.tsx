"use client";

export default function ComingSoonPage() {
  return (
    <div
      className="flex flex-col items-center justify-center text-center px-6"
      style={{ minHeight: "60vh" }}
    >
      {/* 施工图标 */}
      <span className="text-[64px] leading-none mb-6" role="img" aria-label="正在开发中">
        🚧
      </span>

      {/* 标题 */}
      <h2
        className="m-0 mb-3"
        style={{
          fontSize: "24px",
          fontWeight: 700,
          color: "#0d0d0d",
        }}
      >
        正在开发中
      </h2>

      {/* 描述 */}
      <p
        className="m-0 mb-2"
        style={{
          fontSize: "16px",
          color: "#5d5d5d",
        }}
      >
        精彩剧情即将上线
      </p>
      <p
        className="m-0 mb-6"
        style={{
          fontSize: "16px",
          color: "#5d5d5d",
        }}
      >
        敬请期待...
      </p>

      {/* 占位说明 */}
      <p
        className="m-0"
        style={{
          fontSize: "14px",
          color: "#8f8f8f",
        }}
      >
        上线时间待定
      </p>
    </div>
  );
}
