"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  getChatTurns,
  streamChatMessage,
  type TurnsPageResponse,
} from "@/lib/api";
import { getErrorMessage } from "@/lib/error-map";

export interface CharacterChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  status?: "streaming" | "done" | "error";
}

function createMessageId(prefix: "user" | "assistant") {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function mapTurns(data: TurnsPageResponse): CharacterChatMessage[] {
  return data.turns
    .filter(
      (turn) => turn.author_type === "USER" || turn.author_type === "CHARACTER",
    )
    .filter(
      (turn) =>
        turn.primary_candidate.is_final ||
        turn.primary_candidate.content.trim() !== "",
    )
    .map((turn) => ({
      id: turn.id,
      role: turn.author_type === "USER" ? "user" : "assistant",
      content: turn.primary_candidate.content,
      status: "done" as const,
    }));
}

export function useCharacterChatDialog(chatId: string | null) {
  const [messages, setMessages] = useState<CharacterChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsStreaming(false);
    setMessages((current) =>
      current.map((message) =>
        message.status === "streaming"
          ? { ...message, status: "done" as const }
          : message,
      ),
    );
  }, []);

  const reload = useCallback(async () => {
    if (!chatId) {
      setMessages([]);
      return;
    }
    abortRef.current?.abort();
    abortRef.current = null;
    setIsLoading(true);
    setError(null);
    try {
      const data = await getChatTurns(chatId, { limit: 30 });
      setMessages(mapTurns(data));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [chatId]);

  useEffect(() => {
    void reload();
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, [reload]);

  const send = useCallback(
    async (content: string) => {
      const text = content.trim();
      if (!text || !chatId) return;

      stop();
      const userMessageId = createMessageId("user");
      const assistantMessageId = createMessageId("assistant");
      setMessages((current) => [
        ...current,
        { id: userMessageId, role: "user", content: text, status: "done" },
        {
          id: assistantMessageId,
          role: "assistant",
          content: "",
          status: "streaming",
        },
      ]);
      setIsStreaming(true);
      setError(null);

      const controller = new AbortController();
      abortRef.current = controller;

      const patchAssistantMessage = (
        id: string,
        updater: (message: CharacterChatMessage) => CharacterChatMessage,
      ) => {
        setMessages((current) =>
          current.map((message) =>
            message.id === id ? updater(message) : message,
          ),
        );
      };

      try {
        await streamChatMessage(
          chatId,
          { content: text },
          {
            signal: controller.signal,
            onChunk: (chunk) => {
              patchAssistantMessage(assistantMessageId, (message) => ({
                ...message,
                content: message.content + chunk,
              }));
            },
            onDone: (fullContent) => {
              patchAssistantMessage(assistantMessageId, (message) => ({
                ...message,
                content: fullContent,
                status: "done",
              }));
              setIsStreaming(false);
            },
            onError: (streamError) => {
              patchAssistantMessage(assistantMessageId, (message) => ({
                ...message,
                content: getErrorMessage(streamError),
                status: "error",
              }));
              setIsStreaming(false);
            },
          },
        );
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
        }
        setIsStreaming(false);
      }
    },
    [chatId, stop],
  );

  return {
    messages,
    isStreaming,
    isLoading,
    error,
    send,
    stop,
    reload,
  };
}
