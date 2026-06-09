"use client";

import { startTransition, useRef, useState } from "react";

import { MessageBubble } from "@/app/components/MessageBubble";
import { streamAnswer } from "@/app/lib/api";
import type { ChatMessage, StreamMetadata } from "@/app/types";

function createId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function ChatPanel() {
  const abortRef = useRef<AbortController | null>(null);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);

  function applyMetadata(messageId: string, metadata: StreamMetadata) {
    setMessages((current) =>
      current.map((message) =>
        message.id === messageId
          ? {
            ...message,
            status: "done",
            provider: metadata.provider,
            model: metadata.model,
            sources: metadata.sources,
          }
          : message,
      ),
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedQuestion = question.trim();
    if (!trimmedQuestion || isStreaming) {
      return;
    }

    const userMessageId = createId();
    const assistantMessageId = createId();
    const controller = new AbortController();
    abortRef.current = controller;
    setIsStreaming(true);
    setRequestError(null);
    setQuestion("");

    startTransition(() => {
      setMessages((current) => [
        ...current,
        {
          id: userMessageId,
          role: "user",
          content: trimmedQuestion,
          status: "done",
          sources: [],
        },
        {
          id: assistantMessageId,
          role: "assistant",
          content: "",
          status: "streaming",
          sources: [],
        },
      ]);
    });

    try {
      await streamAnswer(
        { question: trimmedQuestion },
        {
          onToken(token) {
            setMessages((current) =>
              current.map((message) =>
                message.id === assistantMessageId
                  ? { ...message, content: `${message.content}${token}` }
                  : message,
              ),
            );
          },
          onComplete(metadata) {
            applyMetadata(assistantMessageId, metadata);
          },
        },
        controller.signal,
      );
    } catch (error) {
      if (controller.signal.aborted) {
        setMessages((current) =>
          current.map((message) =>
            message.id === assistantMessageId
              ? { ...message, status: "done" }
              : message,
          ),
        );
      } else {
        const message =
          error instanceof Error ? error.message : "The answer stream failed.";

        setRequestError(message);
        setMessages((current) =>
          current.map((entry) =>
            entry.id === assistantMessageId
              ? {
                ...entry,
                status: "error",
                error: message,
                content:
                  entry.content ||
                  "I could not complete the answer. Check the backend logs and try again.",
              }
              : entry,
          ),
        );
      }
    } finally {
      abortRef.current = null;
      setIsStreaming(false);
    }
  }

  function stopStreaming() {
    abortRef.current?.abort();
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-6">
      <div className="space-y-2">
        <p className="font-technical text-xs uppercase tracking-[0.26em] text-indigo-300/80">
          Chat Interface
        </p>
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight text-white">
            Ask the corpus
          </h2>
          <p className="text-sm leading-7 text-slate-300">
            Questions are sent to POST /chat/ask/stream and the answer streams back
            token by token. Every completed response includes grounded source chunks.
          </p>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl border border-white/10 bg-white/3">
        <div className="flex items-center justify-between gap-4 border-b border-white/8 px-4 py-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-100">Conversation</h3>
            <p className="font-technical mt-1 text-xs text-slate-400">
              Streaming responses with citations
            </p>
          </div>

          {isStreaming ? (
            <button
              type="button"
              onClick={stopStreaming}
              className="rounded-full border border-rose-400/25 bg-rose-500/8 px-3 py-1.5 text-xs text-rose-100 transition hover:bg-rose-500/[0.14]"
            >
              Stop
            </button>
          ) : null}
        </div>

        <div className="scrollbar-subtle flex-1 overflow-y-auto px-4 py-5">
          {messages.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <div className="max-w-lg rounded-[28px] border border-dashed border-white/12 bg-slate-950/35 px-6 py-10 text-center">
                <p className="font-technical text-xs uppercase tracking-[0.22em] text-slate-500">
                  Ready
                </p>
                <h3 className="mt-3 text-2xl font-semibold text-white">
                  Start with a grounded question
                </h3>
                <p className="mt-3 text-sm leading-7 text-slate-400">
                  Example: What does the uploaded handbook say about onboarding, and
                  which pages support that answer?
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-white/8 px-4 py-4">
          {requestError ? (
            <div className="mb-3 rounded-2xl border border-rose-400/20 bg-rose-500/8 px-4 py-3 text-sm text-rose-100">
              {requestError}
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-3">
            <label htmlFor="question" className="sr-only">
              Ask a question
            </label>
            <textarea
              id="question"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
              placeholder="Ask a question about the uploaded documents..."
              rows={4}
              className="font-technical w-full resize-none rounded-3xl border border-white/10 bg-slate-950/50 px-4 py-4 text-sm leading-7 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-indigo-400/40 focus:ring-2 focus:ring-indigo-500/20"
            />

            <div className="flex items-center justify-between gap-4">
              <p className="font-technical text-xs text-slate-500">
                Press Enter to send. Shift + Enter adds a new line.
              </p>
              <button
                type="submit"
                disabled={!question.trim() || isStreaming}
                className="inline-flex h-11 items-center justify-center rounded-2xl bg-indigo-500 px-5 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:bg-indigo-500/30 disabled:text-slate-300"
              >
                {isStreaming ? "Streaming..." : "Send question"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
