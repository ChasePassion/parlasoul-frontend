"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  createForgeSession,
  deleteForgeSession,
  getForgeSession,
  listForgeSessions,
  publishCharacter,
  renameForgeSession,
  steerForgeMessage,
  streamForgeMessage,
  type ChatImageRef,
  type ForgeMessageItem,
  type ForgeSessionDetail,
  type ForgeSessionSummary,
  type ForgeUiPayload,
} from "@/lib/api";
import { getErrorMessage } from "@/lib/error-map";
import { useAuth } from "@/lib/auth-context";
import { queryKeys } from "@/lib/query";

export interface ForgeToolEvent {
  id: string;
  tool: string;
  label: string;
  status: "running" | "done" | "error";
  summary?: string;
}

export type ForgeSteerStatus = "queued" | "sent" | "discarded";

/** Ordered render units for one assistant turn. Text, thinking, tool calls and
 *  result cards are interleaved in the order they actually happened. */
export type ForgeMessagePart =
  | { type: "content"; text: string }
  | { type: "thought"; text: string }
  | { type: "tool"; event: ForgeToolEvent }
  | { type: "payload"; payload: ForgeUiPayload };

export interface ForgeMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  parts: ForgeMessagePart[];
  images: ChatImageRef[];
  createdAt?: string | null;
  streaming?: boolean;
  steerStatus?: ForgeSteerStatus;
}

/** Consecutive chunks of the same text kind merge into one part; a different
 *  kind starts a new part so the thought / tool / text loop stays intact. */
function appendTextPart(
  parts: ForgeMessagePart[],
  type: "content" | "thought",
  chunk: string,
): ForgeMessagePart[] {
  const last = parts[parts.length - 1];
  if (last && last.type === type) {
    return [...parts.slice(0, -1), { type, text: last.text + chunk }];
  }
  return [...parts, { type, text: chunk }];
}

interface UseCharacterForgeResult {
  sessions: ForgeSessionSummary[];
  activeSessionId: string | null;
  messages: ForgeMessage[];
  isStreaming: boolean;
  toolStatus: string | null;
  error: string | null;
  isLoading: boolean;
  createdCharacterId: string | null;
  createdChatId: string | null;
  publishingCharacterId: string | null;
  send: (content: string, images?: ChatImageRef[]) => Promise<void>;
  steer: (content: string) => Promise<void>;
  publishCreatedCharacter: () => Promise<void>;
  stop: () => void;
  newSession: () => Promise<void>;
  openSession: (sessionId: string) => Promise<void>;
  removeSession: (sessionId: string) => Promise<void>;
  renameSession: (sessionId: string, title: string) => Promise<void>;
  clearError: () => void;
}

function mapMessage(item: ForgeMessageItem): ForgeMessage {
  // Persisted messages have no part boundaries; fall back to text followed by
  // result cards, the same way ZCode builds fallback assistant parts.
  const parts: ForgeMessagePart[] = [];
  if (item.content) parts.push({ type: "content", text: item.content });
  for (const payload of item.ui_payloads ?? []) {
    parts.push({ type: "payload", payload });
  }
  return {
    id: item.id,
    role: item.role === "user" ? "user" : "assistant",
    content: item.content ?? "",
    parts,
    images: item.images ?? [],
    createdAt: item.created_at ?? null,
  };
}

function isEmptyAssistant(message: ForgeMessage): boolean {
  return message.role === "assistant" && message.parts.length === 0;
}

function settleTranscript(messages: ForgeMessage[]): ForgeMessage[] {
  return messages
    .map((message) =>
      message.streaming ? { ...message, streaming: false } : message,
    )
    .map((message) =>
      message.steerStatus === "queued"
        ? { ...message, steerStatus: "discarded" as const }
        : message,
    )
    .filter((message) => !isEmptyAssistant(message));
}

function findCreatedChatId(messages: ForgeMessage[]): string | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    for (const part of messages[index].parts) {
      if (
        part.type === "payload" &&
        part.payload.type === "character_created" &&
        part.payload.chat_id
      ) {
        return part.payload.chat_id;
      }
    }
  }
  return null;
}

// Keep in sync with _WELCOME_MESSAGE in character_forge_service.py. A fresh
// forge session always starts with this single assistant message, so the client
// can render it immediately instead of waiting for the create-session request.
const FORGE_WELCOME_MESSAGE =
  "告诉我你想要一个什么样的角色。身份、性格、你和 TA 的关系，说一点就够了。";

function localWelcomeMessage(): ForgeMessage {
  return {
    id: `local-welcome-${crypto.randomUUID()}`,
    role: "assistant",
    content: FORGE_WELCOME_MESSAGE,
    parts: [{ type: "content", text: FORGE_WELCOME_MESSAGE }],
    images: [],
  };
}

export function useCharacterForge(): UseCharacterForgeResult {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [sessions, setSessions] = useState<ForgeSessionSummary[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ForgeMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [toolStatus, setToolStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [createdCharacterId, setCreatedCharacterId] = useState<string | null>(null);
  const [createdChatId, setCreatedChatId] = useState<string | null>(null);
  const [publishingCharacterId, setPublishingCharacterId] = useState<string | null>(
    null,
  );
  const abortRef = useRef<AbortController | null>(null);
  const activeAssistantIdRef = useRef<string | null>(null);
  const initializedRef = useRef(false);
  const activeSessionIdRef = useRef<string | null>(null);
  const sessionCreatingRef = useRef<Promise<string | null> | null>(null);
  const sessionRequestIdRef = useRef(0);

  const refreshSessions = useCallback(async (): Promise<ForgeSessionSummary[]> => {
    try {
      const page = await listForgeSessions({ limit: 30 });
      setSessions(page.items);
      return page.items;
    } catch (err) {
      setError(getErrorMessage(err));
      return [];
    }
  }, []);

  const openSession = useCallback(async (sessionId: string) => {
    abortRef.current?.abort();
    activeAssistantIdRef.current = null;
    const requestId = ++sessionRequestIdRef.current;
    sessionCreatingRef.current = null;

    // Clear the old transcript immediately so the loading state never shows
    // stale messages mixed with the skeleton.
    setIsLoading(true);
    setMessages([]);
    setActiveSessionId(null);
    activeSessionIdRef.current = null;
    setError(null);
    setToolStatus(null);
    try {
      const detail: ForgeSessionDetail = await getForgeSession(sessionId);
      if (requestId !== sessionRequestIdRef.current) return;
      setActiveSessionId(detail.session.id);
      activeSessionIdRef.current = detail.session.id;
      setCreatedCharacterId(detail.session.active_character_id ?? null);
      const mapped = detail.items.map(mapMessage);
      setMessages(mapped);
      setCreatedChatId(findCreatedChatId(mapped));
    } catch (err) {
      if (requestId === sessionRequestIdRef.current) {
        setError(getErrorMessage(err));
      }
    } finally {
      if (requestId === sessionRequestIdRef.current) setIsLoading(false);
    }
  }, []);

  const newSession = useCallback(async () => {
    abortRef.current?.abort();
    activeAssistantIdRef.current = null;
    const requestId = ++sessionRequestIdRef.current;

    const previous = {
      sessionId: activeSessionIdRef.current,
      messages,
      createdCharacterId,
      createdChatId,
    };

    // A fresh session is fully predictable, so switch to it immediately and
    // create it in the background. No loading state, no layout shift.
    setMessages([localWelcomeMessage()]);
    setActiveSessionId(null);
    activeSessionIdRef.current = null;
    setCreatedCharacterId(null);
    setCreatedChatId(null);
    setError(null);
    setToolStatus(null);
    setIsLoading(false);

    const task = (async (): Promise<string | null> => {
      const detail = await createForgeSession();
      if (requestId !== sessionRequestIdRef.current) return null;
      setActiveSessionId(detail.session.id);
      activeSessionIdRef.current = detail.session.id;
      setCreatedCharacterId(detail.session.active_character_id ?? null);
      const mapped = detail.items.map(mapMessage);
      // Keep the optimistic transcript if the user already sent a message
      // while the session was being created.
      setMessages((prev) =>
        prev.length === 1 && prev[0].id.startsWith("local-welcome-")
          ? mapped
          : prev,
      );
      setCreatedChatId(findCreatedChatId(mapped));
      void refreshSessions();
      return detail.session.id;
    })();
    sessionCreatingRef.current = task;
    try {
      await task;
    } catch (err) {
      if (requestId === sessionRequestIdRef.current) {
        setActiveSessionId(previous.sessionId);
        activeSessionIdRef.current = previous.sessionId;
        setMessages(previous.messages);
        setCreatedCharacterId(previous.createdCharacterId);
        setCreatedChatId(previous.createdChatId);
        setError(getErrorMessage(err));
      }
    } finally {
      if (sessionCreatingRef.current === task) {
        sessionCreatingRef.current = null;
      }
    }
  }, [createdCharacterId, createdChatId, messages, refreshSessions]);

  const removeSession = useCallback(
    async (sessionId: string) => {
      try {
        await deleteForgeSession(sessionId);
        const items = await refreshSessions();
        if (sessionId === activeSessionId) {
          if (items.length > 0) {
            await openSession(items[0].id);
          } else {
            await newSession();
          }
        }
      } catch (err) {
        setError(getErrorMessage(err));
      }
    },
    [activeSessionId, newSession, openSession, refreshSessions],
  );

  const renameSession = useCallback(
    async (sessionId: string, title: string) => {
      await renameForgeSession(sessionId, title);
      setSessions((prev) =>
        prev.map((session) =>
          session.id === sessionId ? { ...session, title } : session,
        ),
      );
    },
    [],
  );

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    void (async () => {
      const items = await refreshSessions();
      if (items.length > 0) {
        await openSession(items[0].id);
      } else {
        await newSession();
      }
    })();
  }, [newSession, openSession, refreshSessions]);

  const publishCreatedCharacter = useCallback(async () => {
    if (!createdCharacterId) return;
    setPublishingCharacterId(createdCharacterId);
    setError(null);
    try {
      const updated = await publishCharacter(createdCharacterId);
      setMessages((prev) =>
        prev.map((message) => ({
          ...message,
          parts: message.parts.map((part) =>
            part.type === "payload" &&
            part.payload.type === "character_created" &&
            part.payload.character_id === updated.id
              ? {
                  ...part,
                  payload: {
                    ...part.payload,
                    visibility:
                      updated.visibility === "PUBLIC"
                        ? ("PUBLIC" as const)
                        : ("PRIVATE" as const),
                  },
                }
              : part,
          ),
        })),
      );
      void queryClient.invalidateQueries({
        queryKey: queryKeys.characters.mine(user?.id ?? null),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.sidebar.characters(user?.id ?? null),
      });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setPublishingCharacterId(null);
    }
  }, [createdCharacterId, queryClient, user?.id]);

  const steer = useCallback(
    async (content: string) => {
      const text = content.trim();
      const sessionId = activeSessionIdRef.current;
      if (!text || !sessionId) return;

      // The client-generated id lets the stream reconcile this bubble even
      // when `steer_drained` arrives before the POST response does.
      const steerId = crypto.randomUUID();
      setMessages((prev) => [
        ...prev,
        {
          id: steerId,
          role: "user",
          content: text,
          parts: [],
          images: [],
          steerStatus: "queued",
        },
      ]);

      try {
        const result = await steerForgeMessage(sessionId, text, steerId);
        if (result.steer_id !== steerId) {
          setMessages((prev) =>
            prev.map((message) =>
              message.id === steerId
                ? { ...message, id: result.steer_id }
                : message,
            ),
          );
        }
      } catch (err) {
        setMessages((prev) =>
          prev.map((message) =>
            message.id === steerId
              ? { ...message, steerStatus: "discarded" }
              : message,
          ),
        );
        setError(getErrorMessage(err));
      }
    },
    [],
  );

  const send = useCallback(
    async (content: string, images?: ChatImageRef[]) => {
      const text = content.trim();
      if (!text) return;

      let sessionId = activeSessionIdRef.current;
      if (!sessionId) {
        const creating = sessionCreatingRef.current;
        if (!creating) return;
        try {
          sessionId = await creating;
        } catch {
          // newSession already surfaced the error and rolled back.
          return;
        }
        if (!sessionId) return;
      }

      if (isStreaming) {
        await steer(text);
        return;
      }

      const controller = new AbortController();
      abortRef.current = controller;
      setIsStreaming(true);
      setError(null);
      setToolStatus(null);

      const userMessageId = `local-user-${crypto.randomUUID()}`;
      const assistantMessageId = `local-assistant-${crypto.randomUUID()}`;
      activeAssistantIdRef.current = assistantMessageId;
      setMessages((prev) => [
        ...prev,
        {
          id: userMessageId,
          role: "user",
          content: text,
          parts: [],
          images: images ?? [],
        },
        {
          id: assistantMessageId,
          role: "assistant",
          content: "",
          parts: [],
          images: [],
          streaming: true,
        },
      ]);

      const updateActiveAssistant = (
        updater: (message: ForgeMessage) => ForgeMessage,
      ) => {
        const activeId = activeAssistantIdRef.current;
        if (!activeId) return;
        setMessages((prev) =>
          prev.map((message) =>
            message.id === activeId ? updater(message) : message,
          ),
        );
      };

      const appendAssistantText = (chunk: string) => {
        updateActiveAssistant((message) => ({
          ...message,
          content: message.content + chunk,
          parts: appendTextPart(message.parts, "content", chunk),
        }));
      };

      const appendReasoning = (chunk: string) => {
        updateActiveAssistant((message) => ({
          ...message,
          parts: appendTextPart(message.parts, "thought", chunk),
        }));
      };

      const startToolEvent = (tool: string, label: string) => {
        const event: ForgeToolEvent = {
          id: crypto.randomUUID(),
          tool,
          label,
          status: "running",
        };
        updateActiveAssistant((message) => ({
          ...message,
          parts: [...message.parts, { type: "tool", event }],
        }));
      };

      const finishToolEvent = (tool: string, ok: boolean, summary?: string) => {
        updateActiveAssistant((message) => {
          const parts = [...message.parts];
          for (let index = parts.length - 1; index >= 0; index -= 1) {
            const part = parts[index];
            if (
              part.type === "tool" &&
              part.event.status === "running" &&
              part.event.tool === tool
            ) {
              parts[index] = {
                ...part,
                event: {
                  ...part.event,
                  status: ok ? "done" : "error",
                  summary,
                },
              };
              break;
            }
          }
          return { ...message, parts };
        });
      };

      const appendPayload = (payload: ForgeUiPayload) => {
        updateActiveAssistant((message) => ({
          ...message,
          parts: [...message.parts, { type: "payload", payload }],
        }));
      };

      await streamForgeMessage(sessionId, text, {
        signal: controller.signal,
        images,
        onEvent: (event) => {
          if (event.type === "chunk") {
            setToolStatus(null);
            appendAssistantText(event.content);
          } else if (event.type === "reasoning") {
            appendReasoning(event.content);
          } else if (event.type === "tool_started") {
            setToolStatus(event.label);
            startToolEvent(event.tool, event.label);
          } else if (event.type === "tool_finished") {
            setToolStatus(null);
            finishToolEvent(event.tool, event.ok, event.summary);
          } else if (event.type === "steer_drained") {
            // The queued input is now real history. Close the assistant block
            // produced before it and open a fresh one for the continuation so
            // the transcript order stays assistant / user / assistant.
            const nextAssistantId = `local-assistant-${crypto.randomUUID()}`;
            const previousAssistantId = activeAssistantIdRef.current;
            activeAssistantIdRef.current = nextAssistantId;
            setMessages((prev) => {
              const reconciled = prev.map((message) => {
                const item = event.items.find(
                  (candidate) => candidate.steer_id === message.id,
                );
                return item
                  ? { ...message, id: item.message_id, steerStatus: "sent" as const }
                  : message;
              });
              const closed = reconciled.map((message) =>
                message.id === previousAssistantId
                  ? { ...message, streaming: false }
                  : message,
              );
              return [
                ...closed,
                {
                  id: nextAssistantId,
                  role: "assistant" as const,
                  content: "",
                  parts: [],
                  images: [],
                  streaming: true,
                },
              ];
            });
          } else if (event.type === "steer_discarded") {
            const discarded = new Set(event.steer_ids);
            setMessages((prev) =>
              prev.map((message) =>
                discarded.has(message.id)
                  ? { ...message, steerStatus: "discarded" as const }
                  : message,
              ),
            );
          } else if (event.type === "voice_preview") {
            appendPayload(event.payload);
          } else if (event.type === "character_created") {
            appendPayload(event.payload);
            setCreatedCharacterId(event.payload.character_id);
            setCreatedChatId(event.payload.chat_id ?? null);
            void queryClient.invalidateQueries({
              queryKey: queryKeys.characters.mine(user?.id ?? null),
            });
            void queryClient.invalidateQueries({
              queryKey: queryKeys.sidebar.characters(user?.id ?? null),
            });
          } else if (event.type === "character_updated") {
            appendPayload(event.payload);
            void queryClient.invalidateQueries({
              queryKey: queryKeys.characters.mine(user?.id ?? null),
            });
          } else if (event.type === "error") {
            setError(event.message ?? "生成失败，请重试");
          }
        },
        onError: (err) => {
          setError(getErrorMessage(err));
        },
      });

      activeAssistantIdRef.current = null;
      setMessages(settleTranscript);
      setIsStreaming(false);
      setToolStatus(null);
      abortRef.current = null;
      void refreshSessions();
    },
    [isStreaming, queryClient, refreshSessions, steer, user?.id],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    activeAssistantIdRef.current = null;
    setIsStreaming(false);
    setToolStatus(null);
    setMessages(settleTranscript);
  }, []);

  return {
    sessions,
    activeSessionId,
    messages,
    isStreaming,
    toolStatus,
    error,
    isLoading,
    createdCharacterId,
    createdChatId,
    publishingCharacterId,
    send,
    steer,
    publishCreatedCharacter,
    stop,
    newSession,
    openSession,
    removeSession,
    renameSession,
    clearError: () => setError(null),
  };
}
