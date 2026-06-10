import { SourceCard } from "@/app/components/SourceCard";
import type { ChatMessage } from "@/app/types";

type MessageBubbleProps = {
  message: ChatMessage;
};

export function MessageBubble({ message }: MessageBubbleProps) {
  const isAssistant = message.role === "assistant";

  return (
    <article
      className={`flex ${isAssistant ? "justify-start" : "justify-end"}`}
      aria-live={message.status === "streaming" ? "polite" : undefined}
    >
      <div
        className={[
          "w-full max-w-3xl rounded-md border px-5 py-3 shadow-[0_16px_34px_rgba(118,133,160,0.10)]",
          isAssistant
            ? "border-slate-200/80 bg-white/84 dark:border-slate-800 dark:bg-slate-900/85"
            : "border-indigo-200 bg-linear-to-br from-indigo-50 to-white dark:border-blue-500/20 dark:from-blue-500/15 dark:to-slate-900",
        ].join(" ")}
      >
        <div className="mb-3 flex items-center justify-between gap-4">
          <p className="font-technical text-xs uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
            {isAssistant ? "Assistant" : "You"}
          </p>

        </div>

        <div className="font-technical whitespace-pre-wrap text-sm leading-7 text-slate-800 dark:text-slate-100">
          {message.content || (message.status === "streaming" ? "Thinking" : "")}
          {message.status === "streaming" ? (
            <span className="streaming-cursor" aria-hidden="true" />
          ) : null}
        </div>

        {message.status === "error" && message.error ? (
          <p className="mt-3 rounded-[20px] border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">
            {message.error}
          </p>
        ) : null}

        {isAssistant && message.sources.length > 0 ? (
          <div className="mt-5 space-y-3">
            <div className="flex items-center justify-between gap-4">
              <p className="font-technical text-xs tracking-[0.18em] text-slate-500 dark:text-slate-400">
                Source Citations
              </p>

            </div>

            <div className="space-y-3">
              {message.sources.map((source, index) => (
                <SourceCard
                  key={`${source.source}-${source.page ?? "na"}-${index}`}
                  source={source}
                  index={index}
                />
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </article>
  );
}
