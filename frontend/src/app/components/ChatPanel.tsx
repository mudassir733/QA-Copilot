"use client";

import { startTransition, useRef, useState } from "react";

import { MessageBubble } from "@/app/components/MessageBubble";
import { streamAnswer } from "@/app/lib/api";
import type { ChatMessage, QuestionRequest, StreamMetadata } from "@/app/types";

const MODEL_OPTIONS: Array<{
  value: NonNullable<QuestionRequest["provider"]>;
  label: string;
  note: string;
}> = [
    { value: "groq", label: "Groq", note: "fast" },
    { value: "gemini", label: "Gemini", note: "balanced" },
    { value: "mistral", label: "Mistral", note: "concise" },
  ];

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
  const [selectedProvider, setSelectedProvider] =
    useState<NonNullable<QuestionRequest["provider"]>>("groq");

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
        { question: trimmedQuestion, provider: selectedProvider },
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
    <div className="flex flex-col gap-6">
      <div className="flex min-h-180 flex-col overflow-hidden rounded-md border border-slate-200/80 bg-white/65 shadow-[0_14px_40px_rgba(118,133,160,0.08)] dark:border-slate-800 dark:bg-slate-900/75">
        <div className="flex items-center justify-between gap-4 border-b border-slate-200/70 px-5 py-4 dark:border-slate-800">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Conversation</h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Streaming answers with inline source evidence
            </p>
          </div>

          {isStreaming ? (
            <button
              type="button"
              onClick={stopStreaming}
              className="rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-medium text-rose-700 transition hover:bg-rose-100"
            >
              Stop response
            </button>
          ) : null}
        </div>

        <div className="scrollbar-subtle flex-1 overflow-y-auto px-5 py-5">
          {messages.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <div className="max-w-xl rounded-md border border-slate-200 bg-[#fbfaf7] px-6 py-10 text-center shadow-[0_14px_40px_rgba(118,133,160,0.08)] dark:border-slate-800 dark:bg-slate-950">
                <h3 className="mt-3 text-2xl font-semibold text-slate-900 dark:text-slate-100">
                  Start with a grounded question
                </h3>
                <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-400">
                  You are currently set to <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedProvider}</span>.
                  Ask something like: what does the uploaded handbook say about onboarding,
                  and which pages support that answer?
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

        <div className="border-t border-slate-200/70 px-5 py-5 dark:border-slate-800">
          {requestError ? (
            <div className="mb-3 rounded-3xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
              {requestError}


            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-4">
            <label htmlFor="question" className="sr-only">
              Ask a question
            </label>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
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
                className="font-technical w-full h-14 max-h-4/12 resize-none rounded-md border border-slate-200 bg-[#fbfaf7] px-4 py-3 text-sm leading-7 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-400 dark:focus:ring-blue-500/20"
              />

              <button
                type="submit"
                disabled={!question.trim() || isStreaming}
                className="inline-flex h-12 items-center cursor-pointer justify-center rounded-md bg-slate-950 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
              >
                {isStreaming ? "Streaming..." : "Send"}
              </button>
            </div>

            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="relative">
                  <select
                    id="model"
                    value={selectedProvider}
                    onChange={(event) =>
                      setSelectedProvider(
                        event.target.value as NonNullable<QuestionRequest["provider"]>,
                      )
                    }
                    disabled={isStreaming}
                    className="min-w-45 appearance-none rounded-md border border-slate-200 bg-white px-4 py-2 pr-10 text-sm font-medium text-slate-800 outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-200 disabled:cursor-not-allowed dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-blue-400 cursor-pointer dark:focus:ring-blue-500/20"
                  >
                    {MODEL_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label} · {option.note}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
