import { UploadPanel } from "@/app/components/UploadPanel";
import type { SourceDocument, SourceListResponse } from "@/app/types";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

async function loadInitialSources(): Promise<SourceDocument[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/ingest/sources`, {
      cache: "no-store",
    });

    if (!response.ok) {
      return [];
    }

    const payload = (await response.json()) as SourceListResponse;
    return payload.sources;
  } catch {
    return [];
  }
}

export default async function UploadPage() {
  const initialSources = await loadInitialSources();
  const totalDocuments = initialSources.length;
  const totalChunks = initialSources.reduce((sum, item) => sum + item.chunk_count, 0);

  return (
    <section className="mx-auto max-w-6xl space-y-6 px-4 py-5 sm:px-6 lg:px-8">
      <div className="rounded-[28px] bg-linear-to-r from-[#377cf6] via-[#2f6df6] to-[#2457ea] px-8 py-8 text-white shadow-[0_18px_40px_rgba(47,109,246,0.28)] dark:from-[#1d4ed8] dark:via-[#1e40af] dark:to-[#1e3a8a]">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <p className="font-technical text-xs uppercase tracking-[0.26em] text-blue-100/80">
              Upload Hub
            </p>
            <h3 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
              Build the knowledge base before you ask.
            </h3>
            <p className="mt-3 text-sm leading-7 text-blue-100/90 sm:text-base">
              Add the source files your QA Copilot should reason over, then jump
              directly into the chat workspace once ingestion is complete.
            </p>
          </div>

          <div className="flex h-40 w-40 items-center justify-center rounded-full bg-white/10">
            <svg viewBox="0 0 24 24" className="h-20 w-20 text-white/90" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M12 16V4" />
              <path d="M7.5 8.5 12 4l4.5 4.5" />
              <path d="M4 16.5v1.5A2 2 0 0 0 6 20h12a2 2 0 0 0 2-2v-1.5" />
            </svg>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl border border-slate-200 bg-white px-5 py-5 shadow-[0_10px_24px_rgba(148,163,184,0.10)] dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm text-slate-500 dark:text-slate-400">Indexed documents</p>
          <p className="mt-6 text-4xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            {totalDocuments}
          </p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white px-5 py-5 shadow-[0_10px_24px_rgba(148,163,184,0.10)] dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm text-slate-500 dark:text-slate-400">Total source chunks</p>
          <p className="mt-6 text-4xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            {totalChunks}
          </p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white px-5 py-5 shadow-[0_10px_24px_rgba(148,163,184,0.10)] dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm text-slate-500 dark:text-slate-400">Supported formats</p>
          <p className="mt-6 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            PDF, TXT, DOCX
          </p>
        </div>
      </div>

      <UploadPanel initialSources={initialSources} />
    </section>
  );
}
