import type { SourceChunk } from "@/app/types";

type SourceCardProps = {
  source: SourceChunk;
  index: number;
};

export function SourceCard({ source, index }: SourceCardProps) {
  return (
    <details className="group rounded-3xl border border-slate-200 bg-white transition-colors open:border-indigo-200 open:bg-[#edf3ff] dark:border-slate-800 dark:bg-[#121212] dark:open:border-blue-500/30 dark:open:bg-blue-500/10">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3">
        <div className="min-w-0 space-y-1">
          <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
            {source.source}
          </p>
          <p className="font-technical text-xs text-slate-500 dark:text-slate-400">
            Chunk {String(index + 1).padStart(2, "0")}
            {source.page ? `  |  Page ${source.page}` : ""}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {typeof source.score === "number" ? (
            <span className="font-technical rounded-full border border-indigo-200 bg-[#edf3ff] px-2.5 py-1 text-[11px] text-indigo-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300">
              {(source.score * 100).toFixed(0)}% match
            </span>
          ) : null}
          <span className="font-technical text-xs text-slate-500 transition-transform group-open:rotate-45 dark:text-slate-400">
            +
          </span>
        </div>
      </summary>

      <div className="border-t border-slate-200 px-4 py-4 dark:border-slate-800">
        <p className="font-technical whitespace-pre-wrap text-sm leading-6 text-slate-700 dark:text-slate-300">
          {source.content}
        </p>
      </div>
    </details>
  );
}
