import type { SourceChunk } from "@/app/types";

type SourceCardProps = {
  source: SourceChunk;
  index: number;
};

export function SourceCard({ source, index }: SourceCardProps) {
  return (
    <details className="group rounded-2xl border border-white/8 bg-white/3 transition-colors open:border-indigo-400/30 open:bg-indigo-400/6">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3">
        <div className="min-w-0 space-y-1">
          <p className="truncate text-sm font-medium text-slate-100">
            {source.source}
          </p>
          <p className="font-technical text-xs text-slate-400">
            Chunk {String(index + 1).padStart(2, "0")}
            {source.page ? `  |  Page ${source.page}` : ""}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {typeof source.score === "number" ? (
            <span className="font-technical rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[11px] text-emerald-300">
              {(source.score * 100).toFixed(0)}% match
            </span>
          ) : null}
          <span className="font-technical text-xs text-slate-500 transition-transform group-open:rotate-45">
            +
          </span>
        </div>
      </summary>

      <div className="border-t border-white/8 px-4 py-4">
        <p className="font-technical whitespace-pre-wrap text-sm leading-6 text-slate-300">
          {source.content}
        </p>
      </div>
    </details>
  );
}
