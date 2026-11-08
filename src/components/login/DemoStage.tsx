"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Brain } from "lucide-react";

import ChatHeader from "@/components/ChatHeader";
import ChatInput from "@/components/ChatInput";
import ChatMessage, { type Message } from "@/components/ChatMessage";
import { ThoughtPart, ToolEventRow } from "@/components/CharacterForgeWorkspace";
import FeedbackCardPopover from "@/components/FeedbackCardPopover";
import ForgeCharacterCard from "@/components/ForgeCharacterCard";
import ForgeVoicePreviewCard from "@/components/ForgeVoicePreviewCard";
import Markdown from "@/components/Markdown";
import ReplyCardPopover from "@/components/ReplyCardPopover";
import ChatMainFrame from "@/components/layout/ChatMainFrame";
import type { ForgeMessagePart } from "@/hooks/useCharacterForge";

import {
  CONTINUE_LINE,
  DEMO_CHARACTER,
  FEEDBACK_CARD,
  FORGE_PROMPT,
  REPLY,
  REPLY_CARD,
  USER_AVATAR,
  VOICE_TRANSCRIPT,
  forgeParts,
  seedMessages,
} from "./data";

/**
 * 登录页左侧演示 —— 全部由项目真实组件渲染
 *
 * 三幕：
 *   1. 角色聊天：语音输入 → 语音通话 → 播放键（推进剧情）→ 句子卡片 → 更优表达
 *   2. AI 创建角色：一句话 → 思考 / 工具调用 / 音色 / 形象 → 角色卡
 *   3. 音色克隆：音色库 → 克隆弹窗 → 新音色入列
 *
 * 交互全部落在真实组件上：录音态、波形画布、转写态、通话态、卡片浮层都是
 * ChatInput / ChatMessage / FeedbackCardPopover / ReplyCardPopover 自己的实现。
 *
 * 原型页不申请麦克风、也不打 STT 接口：波形由一段合成的电平数据驱动，
 * 转写结果用本地文案代替（见 patchSttRecorder）。
 */

type Scene = "chat" | "create";

interface AnchorRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface ChatState {
  messages: Message[];
  feedbackFor: string | null;
  feedbackAnchor: AnchorRect | null;
  replyCardFor: string | null;
  replyAnchor: AnchorRect | null;
  callState: "idle" | "connecting" | "active";
  callSpeaking: boolean;
}

interface ForgeState {
  userLine: string | null;
  parts: ForgeMessagePart[];
  streaming: boolean;
}

const initialChat = (): ChatState => ({
  messages: seedMessages(),
  feedbackFor: null,
  feedbackAnchor: null,
  replyCardFor: null,
  replyAnchor: null,
  callState: "idle",
  callSpeaking: false,
});

const initialForge = (): ForgeState => ({ userLine: null, parts: [], streaming: false });

class Cancelled extends Error {}

const pick = <T extends HTMLElement>(selector: string, root: ParentNode | null = document) =>
  (root ?? document).querySelector<T>(selector);

const pickLast = <T extends HTMLElement>(selector: string, root: ParentNode | null = document) => {
  const nodes = (root ?? document).querySelectorAll<T>(selector);
  return nodes.length > 0 ? nodes[nodes.length - 1] : null;
};

const pickByText = <T extends HTMLElement>(
  selector: string,
  text: string,
  root: ParentNode | null = document,
) =>
  Array.from((root ?? document).querySelectorAll<T>(selector)).find((node) =>
    (node.textContent ?? "").includes(text),
  ) ?? null;

/**
 * 合成一段「有人在说话」的电平：低频包络 + 高频抖动。
 * 只实现 ChatInput 真正用到的两个方法，喂给它的画布和通话胶囊。
 */
function createDemoMicAnalyser(): AnalyserNode {
  const state = { phase: 0 };
  return {
    frequencyBinCount: 64,
    // 只用低频正弦叠加：有起伏，但不逐帧抖动。
    getByteFrequencyData(target: Uint8Array) {
      state.phase += 0.028;
      const breath = 0.55 + 0.45 * Math.sin(state.phase * 0.8);
      for (let i = 0; i < target.length; i += 1) {
        const band = Math.exp(-i / 18);
        const ripple = 0.5 + 0.5 * Math.sin(state.phase * 1.6 + i * 0.18);
        target[i] = Math.max(0, Math.min(255, Math.round(255 * band * ripple * breath)));
      }
    },
    getByteTimeDomainData(target: Uint8Array) {
      state.phase += 0.03;
      for (let i = 0; i < target.length; i += 1) {
        const wave =
          Math.sin(state.phase * 1.4 + i * 0.35) * 0.28 +
          Math.sin(state.phase * 2.9 + i * 0.11) * 0.12;
        target[i] = Math.max(0, Math.min(255, Math.round(128 + wave * 96)));
      }
    },
  } as unknown as AnalyserNode;
}

const DEMO_ANALYSER = createDemoMicAnalyser();

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return reduced;
}

/**
 * 演示的播放倍速：1.1 表示 1.1 倍速。
 * 脚本里所有等待、打字/流式节奏和光标移动时长都按这个比例缩短。
 */
const DEMO_SPEED = 1.1;

/** 第二幕输入框打字的单独倍速：逐字输入比整体节奏更快 */
const DEMO_TYPE_SPEED = 2;

export default function DemoStage() {
  const reduced = useReducedMotion();
  const [scene, setScene] = useState<Scene>("chat");
  const [caption, setCaption] = useState("语音通话：点开就能直接说");
  const [captionSpot, setCaptionSpot] = useState<CaptionSpot>("call");
  const [chat, setChat] = useState<ChatState>(initialChat);
  const [forge, setForge] = useState<ForgeState>(initialForge);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const [moveMs, setMoveMs] = useState(0);
  const [clicking, setClicking] = useState(false);

  const stageRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const forgeScrollRef = useRef<HTMLDivElement>(null);
  const chatSetTextRef = useRef<((text: string) => void) | null>(null);
  const forgeSetTextRef = useRef<((text: string) => void) | null>(null);
  const runRef = useRef(0);

  /**
   * 演示跑在同源 iframe 里，但 iframe 内调用 focus() 仍然会把父页面的焦点
   * 转移到 iframe 上。只要用户已经在父页面操作表单，就忽略演示内部的聚焦请求。
   */
  useEffect(() => {
    if (window.parent === window) return;

    const originalFocus = HTMLElement.prototype.focus;
    const isParentBusy = () => {
      try {
        const parentDocument = window.parent.document;
        const active = parentDocument.activeElement;
        return Boolean(
          active && active !== parentDocument.body && active !== window.frameElement,
        );
      } catch {
        return false;
      }
    };

    HTMLElement.prototype.focus = function (
      this: HTMLElement,
      options?: FocusOptions,
    ) {
      if (isParentBusy()) return;
      originalFocus.call(this, options);
    };

    return () => {
      HTMLElement.prototype.focus = originalFocus;
    };
  }, []);

  /**
   * 演示里的选区可能在异步阶段才生成（Radix 弹层关闭、DOM 更新之后），
   * 只要 iframe 内出现非折叠选区就立刻清掉，避免图片被画上一层选区高亮。
   */
  useEffect(() => {
    const clearSelection = () => {
      const selection = document.getSelection();
      if (selection && !selection.isCollapsed) {
        selection.removeAllRanges();
      }
    };

    document.addEventListener("selectionchange", clearSelection);
    return () => document.removeEventListener("selectionchange", clearSelection);
  }, []);

  // ── 真实组件回调触发的状态变更 ───────────────────────────────────────────

  const handleChatSend = useCallback((text: string) => {
    const content = text.trim();
    if (!content) return;
    setChat((prev) => ({
      ...prev,
      messages: [
        ...prev.messages,
        {
          id: `u-${prev.messages.length}`,
          role: "user" as const,
          content,
          candidateNo: 1,
          candidateCount: 1,
        },
      ],
    }));
  }, []);

  const handleStartCall = useCallback(() => {
    setChat((prev) => ({ ...prev, callState: "connecting" }));
  }, []);

  // 挂断时把通话里的临时字幕落成正式消息：真实产品是回合结束后重新拉取，
  // 原型里没有服务端，直接把这几条转正。
  const handleStopCall = useCallback(() => {
    setChat((prev) => ({
      ...prev,
      callState: "idle",
      callSpeaking: false,
      messages: prev.messages.map((item) => {
        if (!item.isTemp) return item;
        if (item.role === "assistant") {
          return {
            ...item,
            isTemp: false,
            candidateNo: 1,
            candidateCount: 1,
            assistantCandidateId: `cand-${item.id}`,
            replyCard: REPLY_CARD,
          };
        }
        return { ...item, isTemp: false, candidateNo: 1, candidateCount: 1 };
      }),
    }));
  }, []);

  const handleForgeSend = useCallback((text: string) => {
    const content = text.trim();
    if (!content) return;
    setForge({ userLine: content, parts: [], streaming: true });
  }, []);

  const registerChatSetText = useCallback((fn: ((text: string) => void) | null) => {
    chatSetTextRef.current = fn;
  }, []);

  const registerForgeSetText = useCallback((fn: ((text: string) => void) | null) => {
    forgeSetTextRef.current = fn;
  }, []);

  // ── 脚本 ────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (reduced) return;

    const run = ++runRef.current;
    const guard = () => {
      if (runRef.current !== run) throw new Cancelled();
    };

    const sleep = (ms: number, speed = DEMO_SPEED) =>
      new Promise<void>((resolve) => {
        const target = ms / speed;
        const started = performance.now();
        const tick = () => {
          if (performance.now() - started >= target) {
            resolve();
            return;
          }
          window.setTimeout(tick, Math.min(60, target));
        };
        window.setTimeout(tick, Math.min(60, target));
      });

    const say = (text: string, spot: CaptionSpot) => {
      setCaption(text);
      setCaptionSpot(spot);
    };

    const stage = () => stageRef.current;

    const centerOf = (el: HTMLElement) => {
      const rect = el.getBoundingClientRect();
      const box = stage()?.getBoundingClientRect();
      if (!box) return { x: 0, y: 0 };
      return { x: rect.left - box.left + rect.width / 2, y: rect.top - box.top + rect.height / 2 };
    };

    const moveTo = async (el: HTMLElement | null, ms = 460) => {
      if (!el) return;
      // 光标的过渡时长要和 sleep 一起缩短，否则倍速后光标会「走不到」再停一下
      setMoveMs(Math.round(ms / DEMO_SPEED));
      setCursor(centerOf(el));
      await sleep(ms + 40);
      guard();
    };

    const press = async (el: HTMLElement | null) => {
      if (!el) return;
      await sleep(120);
      guard();
      setClicking(true);
      await sleep(70);
      guard();
      el.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
      el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
      el.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
      el.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
      el.click();
      // 合成事件不会自己收尾：只发 mousedown 不发 mouseup 会在页面上留一个空选区，
      // 浏览器把它画在按钮/图片上就是那块「选中态」
      window.getSelection()?.removeAllRanges();
      await sleep(180);
      guard();
      setClicking(false);
    };

    const hover = async (el: HTMLElement | null) => {
      if (!el) return;
      el.dispatchEvent(new MouseEvent("mouseover", { bubbles: true, relatedTarget: null }));
      await sleep(80);
      guard();
    };

    const typeInEditor = async (
      setter: ((text: string) => void) | null,
      text: string,
      step = 42,
    ) => {
      if (!setter) return;
      for (let i = 1; i <= text.length; i += 1) {
        setter(text.slice(0, i));
        await sleep(step, DEMO_TYPE_SPEED);
        guard();
      }
    };

    const pushAssistant = (id: string) =>
      setChat((prev) => ({
        ...prev,
        messages: [
          ...prev.messages,
          {
            id,
            role: "assistant" as const,
            content: "",
            candidateNo: 1,
            candidateCount: 1,
            assistantCandidateId: `cand-${id}`,
            replyCard: REPLY_CARD,
            messageStreamStatus: "streaming" as const,
          },
        ],
      }));

    const streamAssistant = async (id: string, full: string) => {
      for (let i = 1; i <= full.length; i += 2) {
        setChat((prev) => ({
          ...prev,
          messages: prev.messages.map((item) =>
            item.id === id ? { ...item, content: full.slice(0, i) } : item,
          ),
        }));
        await sleep(18);
        guard();
      }
      setChat((prev) => ({
        ...prev,
        messages: prev.messages.map((item) =>
          item.id === id ? { ...item, content: full, messageStreamStatus: "done" as const } : item,
        ),
      }));
    };

    const resetAll = () => {
      setChat(initialChat());
      setForge(initialForge());
    };

    // ── 第一幕：角色聊天 ──────────────────────────────────────────────────
    const runChatScene = async () => {
      setScene("chat");
      say("和你的角色煲电话粥，体验freestyle", "call");
      await sleep(900);
      guard();

      // 1. 语音通话：接通 → 说话 → 消息发进对话 → 角色回复
      const plus = pick<HTMLElement>('[data-testid="composer-plus-btn"]', stage());
      await moveTo(plus, 560);
      await press(plus);
      await sleep(420);
      guard();
      const voiceItem = pickByText<HTMLElement>('[role="dialog"] button', "语音通话");
      await moveTo(voiceItem, 380);
      await press(voiceItem);
      setChat((prev) => ({ ...prev, callState: "connecting" }));
      await sleep(900);
      guard();

      setChat((prev) => ({ ...prev, callState: "active", callSpeaking: false }));
      await sleep(900);
      guard();

      setChat((prev) => ({
        ...prev,
        callSpeaking: true,
        messages: [
          ...prev.messages,
          {
            id: "call-u1",
            role: "user" as const,
            content: VOICE_TRANSCRIPT,
            isTemp: true,
            candidateNo: 1,
            candidateCount: 1,
          },
        ],
      }));
      await sleep(2100);
      guard();

      setChat((prev) => ({
        ...prev,
        callSpeaking: false,
        messages: [
          ...prev.messages,
          {
            id: "call-a1",
            role: "assistant" as const,
            content: REPLY,
            isTemp: true,
          },
        ],
      }));
      await sleep(1700);
      guard();

      const hangup = pick<HTMLElement>('[aria-label="退出语音模式"]', stage());
      await moveTo(hangup, 420);
      await press(hangup);
      await sleep(900);
      guard();

      // 2. 播放键：让角色自己往下说
      say("让你的角色再说一句，最适合推进剧情", "play");
      const play = pick<HTMLElement>('[aria-label="推进剧情"]', stage());
      await moveTo(play, 520);
      await press(play);
      pushAssistant("a-continue");
      await sleep(420);
      guard();
      await streamAssistant("a-continue", CONTINUE_LINE);
      await sleep(700);
      guard();

      // 3. 句子卡片
      say("句子卡片：这句话怎么拆", "sentence");
      const book = pickLast<HTMLElement>('[aria-label="回复卡"]', stage());
      await moveTo(book, 460);
      await press(book);
      await sleep(1900);
      guard();

      // 4. 更优表达：光标直接落到按钮上，悬停让操作行显出来，再点
      say("更优表达：换个更地道的说法", "better");
      const idea = pickLast<HTMLElement>('[aria-label="改进表达"]', stage());
      await moveTo(idea, 560);
      await hover(idea);
      await sleep(240);
      guard();
      await press(idea);
      await sleep(1900);
      guard();
    };

    // ── 第二幕：AI 创建角色 ───────────────────────────────────────────────
    const runCreateScene = async () => {
      setScene("create");
      say("聊聊天，创建任何你想要的角色", "create");
      // 只出现 4 秒，之后这一幕不再有解说
      window.setTimeout(() => {
        if (runRef.current === run) setCaption("");
      }, 4000 / DEMO_SPEED);
      await sleep(900);
      guard();

      await moveTo(pick("#prompt-textarea", stage()), 620);
      await typeInEditor(forgeSetTextRef.current, FORGE_PROMPT, 46);
      await sleep(240);
      guard();

      const send = pick<HTMLElement>('[aria-label="发送消息"]', stage());
      await moveTo(send, 340);
      await press(send);
      await sleep(520);
      guard();

      for (const part of forgeParts()) {
        // 形象生成走 running → done 两步，和真实工具调用一致
        if (part.type === "tool" && part.event.tool === "generate_avatar") {
          const runningEvent = {
            ...part.event,
            status: "running" as const,
            summary: undefined,
          };
          setForge((prev) => ({
            ...prev,
            parts: [...prev.parts, { type: "tool" as const, event: runningEvent }],
          }));
          await sleep(1300);
          guard();
          setForge((prev) => ({
            ...prev,
            parts: prev.parts.map((item) =>
              item.type === "tool" && item.event.id === runningEvent.id ? part : item,
            ),
          }));
          await sleep(700);
          guard();
          continue;
        }

        setForge((prev) => ({ ...prev, parts: [...prev.parts, part] }));
        const wait =
          part.type === "payload"
            ? 1100
            : part.type === "tool"
              ? 620
              : part.type === "thought"
                ? 760
                : 900;
        await sleep(wait);
        guard();
      }
      setForge((prev) => ({ ...prev, streaming: false }));
      await sleep(2400);
      guard();

      const cta = pickByText<HTMLElement>("button", "和 TA 对话", stage());
      await moveTo(cta, 480);
      await press(cta);
      await sleep(800);
      guard();
    };

    const loop = async () => {
      while (runRef.current === run) {
        resetAll();
        await runChatScene();
        await runCreateScene();
        await sleep(600);
        guard();
      }
    };

    void loop().catch((error) => {
      if (!(error instanceof Cancelled)) {
        (window as unknown as { __demoError?: string }).__demoError = String(error);
        console.error(error);
      }
    });

    return () => {
      runRef.current += 1;
    };
  }, [reduced]);

  useEffect(() => {
    setCursor(null);
  }, [scene]);

  return (
    <section className="relative flex h-full min-h-0 flex-col overflow-hidden bg-white">
        <div
          ref={stageRef}
          data-demo-stage
          data-demo-speed={DEMO_SPEED}
          className="relative flex min-h-0 flex-1 select-none flex-col [&_*]:!pointer-events-none"
        >
          <div key={scene} className="flex min-h-0 flex-1 flex-col animate-in fade-in duration-300">
            {scene === "chat" ? (
              <ChatScene
                scrollRef={scrollRef}
                state={chat}
                onSend={handleChatSend}
                onContinue={() => undefined}
                onRegisterSetText={registerChatSetText}
                onFeedback={(id, anchor) =>
                  setChat((prev) => ({ ...prev, feedbackFor: id, feedbackAnchor: anchor }))
                }
                onCloseFeedback={() =>
                  setChat((prev) => ({ ...prev, feedbackFor: null, feedbackAnchor: null }))
                }
                onReplyCard={(id, anchor) =>
                  setChat((prev) => ({ ...prev, replyCardFor: id, replyAnchor: anchor }))
                }
                onCloseReplyCard={() =>
                  setChat((prev) => ({ ...prev, replyCardFor: null, replyAnchor: null }))
                }
                onStartCall={handleStartCall}
                onStopCall={handleStopCall}
                caption={caption}
                captionSpot={captionSpot}
              />
            ) : null}
            {scene === "create" ? (
              <CreateScene
                scrollRef={forgeScrollRef}
                state={forge}
                onSend={handleForgeSend}
                onRegisterSetText={registerForgeSetText}
              />
            ) : null}
          </div>

          {captionSpot === "call" || captionSpot === "play" || captionSpot === "create" ? (
            <CaptionAboveComposer text={caption} spot={captionSpot} />
          ) : null}
          <Cursor cursor={cursor} moveMs={moveMs} clicking={clicking} reduced={reduced} />
        </div>
    </section>
  );
}

type CaptionSpot = "call" | "play" | "sentence" | "better" | "create";

/**
 * 卡片下方的解说。
 *
 * 不写进卡片里，而是和卡片放在同一个浮层（同一个 z-40）、用同一套表面语言：
 * 宽度、圆角、描边、投影都和卡片一致，所以看起来是同一层上的一组，
 * 而不是两张叠着的卡。
 */
function CaptionNote({ text }: { text: string }) {
  return (
    <div className="relative mt-3 w-0 min-w-full">
      <div className="relative animate-in fade-in duration-200 rounded-2xl border border-gray-200 bg-white py-2.5 pl-4 pr-4 shadow-xl">
        <span
          aria-hidden
          className="absolute bottom-2.5 left-0 top-2.5 w-[3px] rounded-full bg-[var(--theme-submit-btn-bg)]"
        />
        <p data-demo-caption className="text-[13px] leading-6 text-gray-600">
          {text}
        </p>
      </div>
    </div>
  );
}

/** 解说卡本体，用于输入框上方 */
function CaptionCard({ text }: { text: string }) {
  return (
    <div className="relative w-[264px] rounded-xl border border-gray-200 bg-white py-2.5 pl-3.5 pr-3.5 shadow-[0_10px_30px_rgba(0,0,0,0.10)]">
      <span className="absolute bottom-2.5 left-0 top-2.5 w-[3px] rounded-full bg-[var(--theme-submit-btn-bg)]" />
      <p data-demo-caption className="text-[13px] leading-6 text-gray-700">
        {text}
      </p>
    </div>
  );
}

/**
 * 输入框相关的解说（语音通话 / 播放键 / 创建角色）都贴在输入框正上方的正中间。
 */
function CaptionAboveComposer({
  text,
  spot,
}: {
  text: string;
  spot: "call" | "play" | "create";
}) {
  if (!text) return null;
  return (
    <div
      data-caption-spot={spot}
      className="pointer-events-none absolute bottom-[92px] left-1/2 z-40 -translate-x-1/2"
    >
      <div key={text} className="animate-in fade-in-0 slide-in-from-bottom-1 duration-200">
        <CaptionCard text={text} />
      </div>
    </div>
  );
}

function Cursor({
  cursor,
  moveMs,
  clicking,
  reduced,
}: {
  cursor: { x: number; y: number } | null;
  moveMs: number;
  clicking: boolean;
  reduced: boolean;
}) {
  if (!cursor) return null;
  return (
    <div
      className="pointer-events-none absolute left-0 top-0 z-[100] will-change-transform"
      style={{
        transform: `translate3d(${cursor.x - 2}px, ${cursor.y - 2}px, 0)`,
        transition: reduced || moveMs === 0 ? undefined : `transform ${moveMs}ms linear`,
      }}
    >

      {clicking ? (
        <span className="absolute -left-3.5 -top-3.5 size-7 animate-ping rounded-full border border-[var(--theme-submit-btn-bg)] opacity-50" />
      ) : null}
      <svg
        width="22"
        height="22"
        viewBox="0 0 1024 1024"
        className="relative"
        style={{
          // 取自 E:\Installer\cursor-glow.svg：同一路径三层蓝色外发光（紧贴亮蓝 → 主蓝 → 大范围深蓝）
          filter: [
            "drop-shadow(0 0 2px #8CC4FF)",
            "drop-shadow(0 0 7px #3D8BFF)",
            "drop-shadow(0 0 16px #1E6BFF)",
            "drop-shadow(0 1px 2px rgba(0,0,0,0.32))",
          ].join(" "),
          opacity: clicking ? 1 : 0.96,
          transition: "opacity 160ms ease-out",
        }}
      >
        <path
          fill="#0d0d0d"
          d="M234.666667 148.608c0-53.248 61.269333-83.2 103.296-50.517333l576.597333 448.554666c48.128 37.418667 21.674667 114.517333-39.253333 114.517334h-292.394667c-21.546667 0-41.856 9.813333-55.210667 26.709333l-178.816 226.133333c-37.632 47.616-114.218667 20.992-114.218666-39.68V148.608z"
        />
      </svg>
    </div>
  );
}

/** 锚点定位：先按锚点摆，再夹进 stage 的可视范围里 */
function CardLayer({
  anchor,
  caption,
  children,
}: {
  anchor: AnchorRect;
  caption?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    const stage = document.querySelector<HTMLElement>("[data-demo-stage]");
    if (!el || !stage) return;
    const box = stage.getBoundingClientRect();
    const card = el.getBoundingClientRect();
    const margin = 10;

    let left = anchor.x + anchor.w + 12;
    if (left + card.width > box.width - margin) {
      left = anchor.x - card.width - 12;
    }
    if (left < margin) {
      left = Math.max(margin, Math.min(box.width - card.width - margin, anchor.x));
    }

    let top = anchor.y + anchor.h / 2 - card.height / 2;
    // 底部给输入框留出空间：卡片（可能还带一条解说）不能压上去
    const bottomLimit = box.height - card.height - 96;
    if (top > bottomLimit) top = bottomLimit;
    if (top < margin) top = margin;

    setPos({ left, top });
  }, [anchor, caption]);

  return (
    <div
      ref={ref}
      className="pointer-events-none absolute z-40"
      style={pos ? { left: pos.left, top: pos.top } : { left: 0, top: 0, visibility: "hidden" }}
    >
      {children}
      {caption ? <CaptionNote text={caption} /> : null}
    </div>
  );
}

// ── 第一幕：角色聊天 ──────────────────────────────────────────────────────

interface ChatSceneProps {
  scrollRef: React.RefObject<HTMLDivElement | null>;
  state: ChatState;
  onSend: (text: string) => void;
  onContinue: () => void;
  onRegisterSetText: (fn: ((text: string) => void) | null) => void;
  onFeedback: (messageId: string, anchor: AnchorRect) => void;
  onCloseFeedback: () => void;
  onReplyCard: (messageId: string, anchor: AnchorRect) => void;
  onCloseReplyCard: () => void;
  onStartCall: () => void;
  onStopCall: () => void;
  caption: string;
  captionSpot: CaptionSpot;
}

function ChatScene({
  scrollRef,
  state,
  onSend,
  onContinue,
  onRegisterSetText,
  onFeedback,
  onCloseFeedback,
  onReplyCard,
  onCloseReplyCard,
  onStartCall,
  onStopCall,
  caption,
  captionSpot,
}: ChatSceneProps) {
  useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [state.messages, scrollRef]);

  const anchorOf = (messageId: string, selector: string): AnchorRect | null => {
    const stage = document.querySelector("[data-demo-stage]");
    const el = document.querySelector(`[data-demo-msg="${messageId}"] ${selector}`);
    if (!stage || !el) return null;
    const box = stage.getBoundingClientRect();
    const rect = el.getBoundingClientRect();
    return { x: rect.left - box.left, y: rect.top - box.top, w: rect.width, h: rect.height };
  };

  return (
    <>
      <ChatMainFrame
        scrollRootRef={scrollRef}
        header={
          <ChatHeader
            character={DEMO_CHARACTER}
            onNewChat={() => undefined}
            onToggleHistory={() => undefined}
          />
        }
        thread={
          <div className="mx-auto flex w-full max-w-[48rem] flex-col gap-4 px-4 pb-4 pt-4">
            {state.messages.map((message) => (
              <div key={message.id} className="relative w-full" data-demo-msg={message.id}>
                <ChatMessage
                  message={message}
                  userAvatar={USER_AVATAR}
                  assistantAvatar={DEMO_CHARACTER.avatar}
                  messageFontSize={16}
                  replyCardEnabled
                  messageActionProfile={state.callState === "active" ? "voice-active" : "text"}
                  onPlayTts={() => undefined}
                  onStopTts={() => undefined}
                  onSelectCandidate={() => undefined}
                  onRegenAssistant={() => undefined}
                  onEditUser={() => undefined}
                  onOpenReplyCard={(item) => {
                    const anchor = anchorOf(item.id, ".bubble-assistant");
                    if (anchor) onReplyCard(item.id, anchor);
                  }}
                  onRequestFeedback={(item) => {
                    const anchor = anchorOf(item.id, ".bubble-user");
                    if (anchor) onFeedback(item.id, anchor);
                  }}
                />
              </div>
            ))}
          </div>
        }
        composer={
          <ChatInput
            onSend={onSend}
            onContinue={onContinue}
            roleName={DEMO_CHARACTER.name}
            onRegisterSetText={onRegisterSetText}
            voiceButtonState={
              state.callState === "connecting"
                ? "connecting"
                : state.callState === "active"
                  ? state.callSpeaking
                    ? "active_user_speaking"
                    : "active_ready"
                  : "idle"
            }
            micCaptureState={state.callState === "active" ? "mic_hot" : "hidden"}
            onStartRealtimeVoice={onStartCall}
            onCancelRealtimeVoiceStart={onStopCall}
            onStopRealtimeVoice={onStopCall}
            getRealtimeMicAnalyserNode={() => DEMO_ANALYSER}
            onToggleMicCapture={() => undefined}
          />
        }
      />

      {/* 卡片浮在滚动区之上：位置按锚点算，并且夹在可视范围内 */}
      <div className="pointer-events-none absolute inset-0 z-40">
        {state.replyCardFor && state.replyAnchor ? (
          <CardLayer
            anchor={state.replyAnchor}
            caption={captionSpot === "sentence" ? caption : ""}
          >
            <ReplyCardPopover
              replyCard={REPLY_CARD}
              onToggleFavorite={() => undefined}
              onClose={onCloseReplyCard}
              placement="right"
            />
          </CardLayer>
        ) : null}

        {state.feedbackFor && state.feedbackAnchor ? (
          <CardLayer
            anchor={state.feedbackAnchor}
            caption={captionSpot === "better" ? caption : ""}
          >
            <FeedbackCardPopover
              feedbackCard={FEEDBACK_CARD}
              onToggleFavorite={() => undefined}
              onClose={onCloseFeedback}
              placement="left"
            />
          </CardLayer>
        ) : null}
      </div>
    </>
  );
}

// ── 第二幕：AI 创建角色 ──────────────────────────────────────────────────

function CreateScene({
  scrollRef,
  state,
  onSend,
  onRegisterSetText,
}: {
  scrollRef: React.RefObject<HTMLDivElement | null>;
  state: ForgeState;
  onSend: (text: string) => void;
  onRegisterSetText: (fn: ((text: string) => void) | null) => void;
}) {
  useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [state.parts, scrollRef]);

  const forgeCharacter = {
    id: "character-forge",
    name: "AI 创建角色",
    description: "告诉我你想要什么样的角色",
    avatar: "/icon.svg",
  };

  return (
    <ChatMainFrame
      scrollRootRef={scrollRef}
      header={
        <ChatHeader
          character={forgeCharacter}
          hideIdentity
          onNewChat={() => undefined}
          onToggleHistory={() => undefined}
          headerAction={
            <button
              type="button"
              className="h-9 rounded-lg border border-divider bg-white px-3 text-[13px] text-gray-700 transition-colors hover:bg-sidebar-hover"
            >
              手动创建
            </button>
          }
        />
      }
      thread={
        <div className="mx-auto flex w-full max-w-[44rem] flex-col gap-6 px-4 pb-4 pt-6">
          {state.userLine ? (
            <div className="flex w-full flex-col items-end">
              <div className="bubble-user max-w-[80%] px-4 py-2 text-sm leading-6 text-text-primary">
                <p className="whitespace-pre-wrap">{state.userLine}</p>
              </div>
            </div>
          ) : null}

          {state.parts.length > 0 || state.streaming ? (
            <div className="flex w-full min-w-0 flex-col gap-3">
              {state.parts.map((part, index) => {
                if (part.type === "thought") {
                  return (
                    <ThoughtPart
                      key={`thought-${index}`}
                      text={part.text}
                      active={state.streaming && index === state.parts.length - 1}
                    />
                  );
                }
                if (part.type === "tool") {
                  return <ToolEventRow key={part.event.id} event={part.event} />;
                }
                if (part.type === "content") {
                  return (
                    <div
                      key={`content-${index}`}
                      className="w-full text-sm leading-7 text-text-primary"
                    >
                      <Markdown content={part.text} variant="assistant" />
                    </div>
                  );
                }
                return (
                  <div key={`payload-${index}`} className="w-full">
                    {part.payload.type === "voice_preview" ? (
                      <ForgeVoicePreviewCard payload={part.payload} />
                    ) : (
                      <ForgeCharacterCard
                        payload={part.payload}
                        onStartChat={() => undefined}
                        onOpenChat={() => undefined}
                        onPublish={() => undefined}
                        isPublishing={false}
                        onRequestAvatar={() => undefined}
                        isRequestingAvatar={false}
                      />
                    )}
                  </div>
                );
              })}

              {state.streaming && state.parts.length === 0 ? (
                <div className="inline-flex items-center gap-2 text-[13px] text-gray-500">
                  <Brain className="h-3.5 w-3.5 animate-pulse" />
                  正在思考
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      }
      composer={
        <ChatInput
          onSend={onSend}
          isStreaming={state.streaming}
          onInterrupt={() => undefined}
          streamingSendable
          showVoiceControls={false}
          showContinueAction={false}
          placeholder="说说你想要一个什么样的角色，或继续补充要求…"
          onRegisterSetText={onRegisterSetText}
        />
      }
    />
  );
}
