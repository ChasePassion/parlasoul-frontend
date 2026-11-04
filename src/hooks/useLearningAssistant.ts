"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  ApiError,
  streamLearningAssistant,
  type LearningAssistantContextMessage,
} from "@/lib/api";
import { getErrorMessage } from "@/lib/error-map";

export interface LearningAssistantMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  status?: "streaming" | "done" | "error";
}

interface AskLearningAssistantArgs {
  question: string;
  characterChatContext: LearningAssistantContextMessage[];
  chatId?: string;
}

interface UseLearningAssistantResult {
  messages: LearningAssistantMessage[];
  isStreaming: boolean;
  ask: (args: AskLearningAssistantArgs) => Promise<void>;
  stop: () => void;
  reset: () => void;
}

function createMessageId(prefix: "user" | "assistant") {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function useLearningAssistant(): UseLearningAssistantResult {
  const [messages, setMessages] = useState<LearningAssistantMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsStreaming(false);
    setMessages((current) =>
      current.map((message) =>
        message.status === "streaming"
          ? {
              ...message,
              status: "done",
            }
          : message,
      ),
    );
  }, []);

  const reset = useCallback(() => {
    stop();
    setMessages([]);
  }, [stop]);

  const ask = useCallback(
    async ({ question, characterChatContext, chatId }: AskLearningAssistantArgs) => {
      const normalizedQuestion = question.trim();
      if (!normalizedQuestion) return;

      stop();

      const userMessageId = createMessageId("user");
      const assistantMessageId = createMessageId("assistant");
      const assistantSessionContext = messages
        .filter((message) => message.content.trim())
        .map<LearningAssistantContextMessage>((message) => ({
          role: message.role,
          content: message.content,
        }));

      setMessages((current) => [
        ...current,
        {
          id: userMessageId,
          role: "user",
          content: normalizedQuestion,
          status: "done",
        },
        {
          id: assistantMessageId,
          role: "assistant",
          content: "",
          status: "streaming",
        },
      ]);
      setIsStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        await streamLearningAssistant(
          {
            question: normalizedQuestion,
            character_chat_context: characterChatContext,
            assistant_chat_context: assistantSessionContext,
            chat_id: chatId,
          },
          {
            signal: controller.signal,
            onChunk: (content) => {
              setMessages((current) =>
                current.map((message) =>
                  message.id === assistantMessageId
                    ? {
                        ...message,
                        content: message.content + content,
                        status: "streaming",
                      }
                    : message,
                ),
              );
            },
            onDone: (fullContent) => {
              setMessages((current) =>
                current.map((message) =>
                  message.id === assistantMessageId
                    ? {
                        ...message,
                        content: fullContent,
                        status: "done",
                      }
                    : message,
                ),
              );
              setIsStreaming(false);
            },
            onError: (streamError) => {
              const errorText =
                streamError instanceof ApiError &&
                streamError.code === "llm_service_error" &&
                streamError.detail
                  ? streamError.detail
                  : getErrorMessage(streamError);

              setMessages((current) =>
                current.map((message) =>
                  message.id === assistantMessageId
                    ? {
                        ...message,
                        content: errorText,
                        status: "error",
                      }
                    : message,
                ),
              );
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
    [messages, stop],
  );

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, []);

  return {
    messages,
    isStreaming,
    ask,
    stop,
    reset,
  };
}
