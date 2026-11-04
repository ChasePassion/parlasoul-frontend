"use client";

import { useState, type ReactNode } from "react";
import { Download } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import type {
  CharacterMilestoneShareCardPayload,
  DailySigninShareCardPayload,
  GrowthShareCard,
} from "@/lib/growth-types";
import {
  getShareCardBackgroundSrc,
  getShareCardDateSeed,
  resolveShareCardImageSrc,
} from "@/lib/share-card-assets";
import { resolveCharacterAvatarSrc } from "@/lib/character-avatar";

const sloganShadowStyle = {
  textShadow: "0 1px 8px rgba(0, 0, 0, 0.4)",
} as const;

const numberShadowStyle = {
  textShadow: "0 2px 16px rgba(0, 0, 0, 0.35)",
  fontWeight: 800,
} as const;

interface ShareCardRendererProps {
  card: GrowthShareCard;
  onDownload?: () => void;
  milestoneFirstChatDate?: string | null;
}

function formatHeaderDate(dateSeed: string): string {
  const [year, month, day] = dateSeed.split("-").map(Number);
  const date = new Date(year, (month ?? 1) - 1, day ?? 1);

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatStoryDate(dateSeed: string): string {
  return dateSeed.replace(/-/g, ".");
}

function formatDateToStoryLine(value?: string | null): string | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");

  return `${year}.${month}.${day}`;
}

function formatCompactCount(value: number): string {
  if (value < 1000) {
    return value.toLocaleString("en-US");
  }

  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    compactDisplay: "short",
    maximumFractionDigits: 1,
  })
    .format(value)
    .replace("K", "k");
}

function formatEquivalent(value: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(value);
}

function getInitials(name?: string | null): string {
  const trimmed = name?.trim();
  if (!trimmed) {
    return "PS";
  }

  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return trimmed.slice(0, 2).toUpperCase();
  }

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function ParlaSoulMark() {
  return (
    <svg
      viewBox="0 0 455 458"
      aria-hidden="true"
      className="h-[18px] w-[18px] shrink-0"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M257.033 9.974C257.838 9.973 258.643 9.972 259.473 9.971C292.703 9.981 324.757 16.977 354 33C355.079 33.588 356.158 34.176 357.27 34.781C367.941 40.809 377.562 48.214 387 56C387.712 56.587 388.424 57.173 389.157 57.777C393.243 61.243 396.848 64.907 400.305 69C401.367 70.252 402.452 71.485 403.57 72.687C414.306 84.304 422.49 97.659 429 112C429.531 113.125 430.062 114.251 430.609 115.41C449.066 156.081 449.915 204.955 434.411 246.701C427.018 265.637 416.973 282.902 403.07 297.774C401.192 299.794 399.442 301.873 397.688 304C385.634 317.772 369.036 327.562 353 336C352.351 336.344 351.702 336.688 351.034 337.043C332.299 346.83 311.79 352.609 291 356C290.196 356.134 289.392 356.269 288.564 356.407C267.355 359.817 246.014 359.486 224.597 359.553C216.738 359.578 208.88 359.618 201.021 359.674C198.324 359.69 195.626 359.694 192.928 359.697C177.176 359.764 161.626 360.863 146.313 364.75C145.783 364.881 145.783 364.881 143.102 365.547C134.455 367.758 126.181 370.443 118 374C117.661 374.145 117.661 374.145 115.942 374.881C101.568 381.113 88.032 388.915 76 399C74.962 399.853 73.924 400.706 72.887 401.559C62.599 410.072 53.805 419.065 45.633 429.621C32.646 446.358 32.646 446.358 22.313 448C19.429 448.159 17.907 447.968 15.125 447C10.805 442.934 9.83 438.361 9.62 432.63C9.603 430.486 9.602 428.341 9.614 426.197C9.608 425.011 9.603 423.826 9.597 422.605C9.585 419.326 9.587 416.047 9.594 412.768C9.599 409.227 9.586 405.685 9.576 402.144C9.559 395.206 9.558 388.268 9.563 381.33C9.567 375.681 9.566 370.031 9.561 364.382C9.56 363.577 9.56 362.771 9.559 361.942C9.558 360.305 9.556 358.669 9.555 357.032C9.541 341.683 9.547 326.333 9.558 310.984C9.568 296.99 9.555 282.997 9.531 269.004C9.507 254.603 9.497 240.202 9.503 225.801C9.507 217.73 9.505 209.659 9.487 201.588C9.472 194.706 9.472 187.824 9.489 180.942C9.497 177.441 9.499 173.94 9.484 170.439C9.323 124.615 21.853 85.757 54.063 52.688C68.333 38.84 85.39 28 104 21C105.219 20.541 106.439 20.082 107.695 19.609C123.362 14.087 139.268 10.904 155.883 10.795C156.828 10.785 157.772 10.775 158.745 10.765C161.846 10.733 164.948 10.708 168.049 10.684C170.23 10.663 172.411 10.642 174.593 10.621C180.331 10.566 186.068 10.516 191.806 10.468C196.44 10.428 201.073 10.384 205.706 10.34C211.3 10.287 216.893 10.235 222.486 10.184C223.006 10.179 223.006 10.179 225.639 10.155C236.103 10.06 246.566 9.983 257.033 9.974ZM76.658 88.076C72.416 92.998 69.115 98.314 66 104C65.683 104.578 65.683 104.578 64.078 107.507C60.541 114.331 58.117 121.319 56.188 128.75C55.993 129.486 55.798 130.222 55.597 130.981C51.83 146.735 51.709 163.058 51.772 179.159C51.773 181.201 51.772 183.243 51.771 185.285C51.771 190.766 51.783 196.246 51.797 201.726C51.81 207.477 51.811 213.228 51.813 218.979C51.819 229.84 51.835 240.702 51.856 251.563C51.878 263.941 51.889 276.318 51.899 288.696C51.92 314.131 51.955 339.566 52 365C55.077 362.577 57.805 360.261 60.313 357.25C72.862 342.725 87.678 332.163 105 324C106.164 323.447 107.328 322.894 108.527 322.324C116.298 318.942 124.221 316.765 132.438 314.75C132.937 314.627 132.937 314.627 135.467 314.004C150.444 310.512 165.102 309.704 180.415 309.665C183.597 309.656 186.779 309.635 189.962 309.612C196.724 309.564 203.487 309.531 210.249 309.5C218.086 309.464 225.922 309.422 233.758 309.364C236.855 309.345 239.952 309.336 243.049 309.328C288.697 309.085 333.091 298.261 366.609 265.543C376.804 255.158 384.169 243.262 390 230C390.481 228.936 390.962 227.871 391.458 226.774C396.468 214.816 399.521 200.983 400 188C400.052 186.874 400.103 185.747 400.156 184.586C401.027 148.379 387.711 116.177 363 90C337.476 64.162 300.662 50.414 264.648 49.86C262.706 49.848 260.765 49.841 258.824 49.839C257.754 49.834 256.684 49.829 255.581 49.824C252.068 49.809 248.555 49.802 245.042 49.797C243.831 49.794 242.62 49.791 241.372 49.788C234.955 49.773 228.537 49.764 222.12 49.76C215.549 49.754 208.978 49.73 202.407 49.701C197.305 49.683 192.202 49.678 187.1 49.677C184.68 49.674 182.261 49.666 179.842 49.653C139.661 49.448 104.649 57.351 76.658 88.076Z"
        fill="currentColor"
      />
      <path
        d="M174.438 153.938C181.134 157.91 186.423 163.415 189.063 170.813C190.94 178.651 190.373 187.143 186.285 194.191C181.834 200.454 176.58 205.127 169 207C158.301 208.08 150.595 207.164 142.25 200.375C136.283 194.799 133.509 187.989 132.688 179.938C133.414 170.789 136.987 162.984 144 157C152.727 150.495 164.478 149.533 174.438 153.938Z"
        fill="currentColor"
      />
      <path
        d="M303.848 155.383C309.318 159.493 314.612 165.11 316 172C317.172 182.557 315.911 190.28 309.527 198.75C304.726 203.861 299.463 206.597 292.488 207.445C282.885 207.734 276.75 206.095 268.902 200.813C261.865 193.615 259.729 186.022 259.801 176.176C260.553 169.382 264.348 162.804 269.152 158C279.281 150.64 292.85 148.815 303.848 155.383Z"
        fill="currentColor"
      />
    </svg>
  );
}

function ShareCardBody({
  intro,
  hero,
  narrative,
}: {
  intro: ReactNode;
  hero: ReactNode;
  narrative: ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-col items-center gap-4 text-center">
        {intro}
      </div>
      <div className="mt-5 flex flex-col items-center gap-2 text-center">
        {hero}
      </div>
      <div className="mt-auto pt-9">
        {narrative}
      </div>
    </div>
  );
}

function ShareCardHero({
  value,
  label,
  labelClassName,
}: {
  value: string;
  label: string;
  labelClassName: string;
}) {
  return (
    <>
      <div
        className="text-[104px] leading-[0.9] tracking-[-0.04em] text-white"
        style={numberShadowStyle}
      >
        {value}
      </div>
      <div className={labelClassName}>{label}</div>
    </>
  );
}

function AvatarCircle({
  src,
  alt,
  fallback,
  className = "",
}: {
  src: string;
  alt: string;
  fallback: string;
  className?: string;
}) {
  const [hasError, setHasError] = useState(false);

  return (
    <div
      className={`relative h-[56px] w-[56px] overflow-hidden rounded-full ${className}`}
      style={{ border: "2px solid rgba(0,0,0,0.15)" }}
    >
      {!hasError ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            crossOrigin="anonymous"
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover"
            onError={() => setHasError(true)}
          />
        </>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-[rgba(255,255,255,0.16)] text-sm font-semibold text-white">
          {fallback}
        </div>
      )}
    </div>
  );
}

function ShareCardFrame({
  card,
  overlayClassName,
  children,
  onDownload,
}: {
  card: GrowthShareCard;
  overlayClassName: string;
  children: ReactNode;
  onDownload?: () => void;
}) {
  const dateSeed = getShareCardDateSeed(card);
  const landscapeSrc = resolveShareCardImageSrc(getShareCardBackgroundSrc(card));

  return (
    <div className="relative w-[360px] overflow-hidden rounded-[16px] text-white shadow-[0_20px_60px_rgba(0,0,0,0.4)]">
      {/* html2canvas captures a real <img> more reliably than next/image here. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={landscapeSrc}
        alt=""
        aria-hidden="true"
        crossOrigin="anonymous"
        referrerPolicy="no-referrer"
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className={`absolute inset-0 ${overlayClassName}`} />

      <div className="relative z-10 flex min-h-[480px] flex-col px-6 pt-[22px] pb-6 text-center">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-[7px] text-white/65">
            <ParlaSoulMark />
            <span className="text-[14px] font-semibold tracking-[0.02em]">
              ParlaSoul
            </span>
          </div>
          <span className="text-[12px] font-medium tracking-[0.08em] text-white/50">
            {formatHeaderDate(dateSeed)}
          </span>
        </div>

        {children}

        <div className="mt-auto flex justify-center pt-4">
          <button
            type="button"
            onClick={onDownload}
            disabled={!onDownload}
            data-download-footer="true"
            className="inline-flex items-center gap-[5px] rounded-[20px] border bg-transparent px-4 py-2 text-[14px] font-semibold tracking-[0.04em] text-white/55 transition-[border-color,color] duration-200 disabled:cursor-not-allowed disabled:opacity-70"
            style={{ borderColor: "rgba(255,255,255,0.2)" }}
          >
            <Download className="h-[14px] w-[14px]" />
            Download
          </button>
        </div>
      </div>
    </div>
  );
}

function DailySigninShareCard({
  card,
  payload,
  onDownload,
}: {
  card: GrowthShareCard;
  payload: DailySigninShareCardPayload;
  onDownload?: () => void;
}) {
  return (
    <ShareCardFrame
      card={card}
      overlayClassName="bg-[linear-gradient(to_bottom,rgba(0,0,0,0.25)_0%,rgba(0,0,0,0.18)_30%,rgba(0,0,0,0.25)_55%,rgba(0,0,0,0.55)_100%)]"
      onDownload={onDownload}
    >
      <ShareCardBody
        intro={
          <p
            className="text-[22px] font-light tracking-[0.01em] text-white/88"
            style={sloganShadowStyle}
          >
            Keep <strong className="font-semibold">learning</strong>
          </p>
        }
        hero={
          <ShareCardHero
            value={payload.current_natural_streak.toLocaleString("en-US")}
            label="Days"
            labelClassName="mt-2 text-[12px] font-semibold uppercase tracking-[0.55em] text-white/50 [text-indent:0.55em]"
          />
        }
        narrative={
          <div className="flex flex-col gap-2 text-center">
            <p className="text-[14px] leading-[1.4] tracking-[0.01em] text-white/60">
              今天共发送{" "}
              <strong className="font-bold text-white/90">
                {payload.today_user_message_count.toLocaleString("en-US")}
              </strong>{" "}
              条消息
            </p>
            <p className="text-[14px] leading-[1.4] tracking-[0.01em] text-white/60">
              总共阅读{" "}
              <strong className="font-bold text-white/90">
                {formatCompactCount(payload.today_total_word_count)}
              </strong>{" "}
              个单词
            </p>
            <p className="text-[14px] leading-[1.4] tracking-[0.01em] text-white/60">
              相当于{" "}
              <strong className="font-bold text-white/90">
                {formatEquivalent(payload.reading_equivalent.cet6_equivalent)}
              </strong>{" "}
              篇六级阅读
            </p>
          </div>
        }
      />
    </ShareCardFrame>
  );
}

function MilestoneShareCard({
  card,
  payload,
  userAvatar,
  userName,
  onDownload,
  firstMessageDate,
}: {
  card: GrowthShareCard;
  payload: CharacterMilestoneShareCardPayload;
  userAvatar: string;
  userName: string | null;
  onDownload?: () => void;
  firstMessageDate?: string | null;
}) {
  const dateSeed = getShareCardDateSeed(card);
  const characterAvatar = resolveShareCardImageSrc(
    resolveCharacterAvatarSrc(payload),
  );
  const proxiedUserAvatar = resolveShareCardImageSrc(userAvatar);
  const firstLineDate =
    formatDateToStoryLine(firstMessageDate) ?? formatStoryDate(dateSeed);

  return (
    <ShareCardFrame
      card={card}
      overlayClassName="bg-[linear-gradient(to_bottom,rgba(0,0,0,0.3)_0%,rgba(0,0,0,0.2)_35%,rgba(0,0,0,0.3)_55%,rgba(0,0,0,0.65)_100%)]"
      onDownload={onDownload}
    >
      <ShareCardBody
        intro={
          <>
            <div className="flex items-center justify-center">
              <AvatarCircle
                src={proxiedUserAvatar}
                alt={userName ?? "user"}
                fallback={getInitials(userName)}
              />
              <AvatarCircle
                src={characterAvatar}
                alt={payload.character_name}
                fallback={getInitials(payload.character_name)}
                className="-ml-2"
              />
            </div>
            <p
              className="text-[20px] font-light leading-[1.3] tracking-[0.01em] text-white/88"
              style={sloganShadowStyle}
            >
              Learning with{" "}
              <strong className="font-semibold">{payload.character_name}</strong>
            </p>
          </>
        }
        hero={
          <ShareCardHero
            value={payload.milestone_message_count.toLocaleString("en-US")}
            label="Messages"
            labelClassName="mt-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/50"
          />
        }
        narrative={
          <div className="flex flex-col gap-1.5 text-center">
            <p className="text-[14px] leading-[1.7] tracking-[0.01em] text-white/65">
              <span className="font-bold text-white/95">{firstLineDate}</span>{" "}
              你给{" "}
              <strong className="font-bold text-white/92">
                {payload.character_name}
              </strong>{" "}
              发送了第一条消息
            </p>
            <p className="text-[14px] leading-[1.7] tracking-[0.01em] text-white/65">
              后来，在{" "}
              <strong className="font-bold text-white/92">
                {payload.chatted_days_count}
              </strong>{" "}
              天里，你发送了{" "}
              <strong className="font-bold text-white/92">
                {payload.milestone_message_count.toLocaleString("en-US")}
              </strong>{" "}
              条消息
            </p>
            <p className="text-[14px] leading-[1.7] tracking-[0.01em] text-white/65">
              累计阅读{" "}
              <strong className="font-bold text-white/92">
                {formatCompactCount(payload.total_word_count)}
              </strong>{" "}
              个单词
            </p>
            <p className="text-[14px] leading-[1.7] tracking-[0.01em] text-white/65">
              相当于{" "}
              <strong className="font-bold text-white/92">
                {formatEquivalent(payload.reading_equivalent.cet6_equivalent)}
              </strong>{" "}
              篇六级阅读
            </p>
          </div>
        }
      />
    </ShareCardFrame>
  );
}

export default function ShareCardRenderer({
  card,
  onDownload,
  milestoneFirstChatDate,
}: ShareCardRendererProps) {
  const { user } = useAuth();
  const userAvatar = user?.avatar_urls?.md || "/default-avatar.svg";
  const userName = user?.username || user?.email || null;

  if (card.kind === "daily_signin_completed" && card.daily_signin_payload) {
    return (
      <DailySigninShareCard
        card={card}
        payload={card.daily_signin_payload}
        onDownload={onDownload}
      />
    );
  }

  if (
    card.kind === "character_message_milestone" &&
    card.character_milestone_payload
  ) {
    return (
      <MilestoneShareCard
        card={card}
        payload={card.character_milestone_payload}
        userAvatar={userAvatar}
        userName={userName}
        onDownload={onDownload}
        firstMessageDate={milestoneFirstChatDate}
      />
    );
  }

  return null;
}
