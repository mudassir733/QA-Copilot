import { ChatPanel } from "@/app/components/ChatPanel";
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

export default async function Home() {
  const initialSources = await loadInitialSources();

  return (
    <main className="panel-grid min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen max-w-[1600px] flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
        <header className="panel-surface rounded-[28px] px-6 py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <p className="font-technical text-xs uppercase tracking-[0.32em] text-indigo-300/80">
                QA Copilot
              </p>
              <div className="space-y-2">
                <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                  Ask grounded questions over your document set.
                </h1>
                <p className="max-w-3xl text-sm leading-7 text-slate-300 sm:text-base">
                  Upload PDFs, TXT files, or DOCX notes on the left. Ask a question on
                  the right and watch the answer stream in with source citations attached.
                </p>
              </div>
            </div>

            <div className="font-technical rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs text-slate-300">
              Backend: {process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000"}
            </div>
          </div>
        </header>

        <section className="grid flex-1 gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
          <div className="panel-surface rounded-[28px] p-5 sm:p-6">
            <UploadPanel initialSources={initialSources} />
          </div>

          <div className="panel-surface rounded-[28px] p-5 sm:p-6">
            <ChatPanel />
          </div>
        </section>
      </div>
    </main>
  );
}
