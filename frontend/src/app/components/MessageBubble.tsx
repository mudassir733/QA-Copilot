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
          "w-full max-w-3xl rounded-3xl border px-5 py-4 shadow-[0_14px_38px_rgba(0,0,0,0.24)]",
          isAssistant
            ? "border-white/8 bg-white/[0.035]"
            : "border-indigo-400/20 bg-indigo-500/[0.14]",
        ].join(" ")}
      >
        <div className="mb-3 flex items-center justify-between gap-4">
          <p className="font-technical text-xs uppercase tracking-[0.22em] text-slate-400">
            {isAssistant ? "Assistant" : "You"}
          </p>

          {isAssistant && message.model ? (
            <p className="font-technical text-[11px] text-slate-500">
              {message.provider} / {message.model}
            </p>
          ) : null}
        </div>

        <div className="font-technical whitespace-pre-wrap text-sm leading-7 text-slate-100">
          {message.content || (message.status === "streaming" ? "Thinking" : "")}
          {message.status === "streaming" ? (
            <span className="streaming-cursor" aria-hidden="true" />
          ) : null}
        </div>

        {message.status === "error" && message.error ? (
          <p className="mt-3 rounded-2xl border border-rose-400/20 bg-rose-500/8 px-3 py-2 text-sm text-rose-200">
            {message.error}
          </p>
        ) : null}

        {isAssistant && message.sources.length > 0 ? (
          <div className="mt-5 space-y-3">
            <div className="flex items-center justify-between gap-4">
              <p className="font-technical text-xs uppercase tracking-[0.18em] text-slate-400">
                Source Citations
              </p>
              <span className="font-technical text-xs text-slate-500">
                {message.sources.length} chunk{message.sources.length === 1 ? "" : "s"}
              </span>
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
