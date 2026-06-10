"use client";

import { useRouter } from "next/navigation";
import { startTransition, useRef, useState } from "react";

import { listSources, uploadDocument } from "@/app/lib/api";
import type { IngestResponse, SourceDocument } from "@/app/types";

type UploadState =
  | { status: "idle" }
  | { status: "uploading" }
  | { status: "success"; response: IngestResponse }
  | { status: "error"; message: string };

type UploadPanelProps = {
  initialSources: SourceDocument[];
};

export function UploadPanel({ initialSources }: UploadPanelProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadState, setUploadState] = useState<UploadState>({ status: "idle" });
  const [sources, setSources] = useState<SourceDocument[]>(initialSources);
  const [isLoadingSources, setIsLoadingSources] = useState(false);
  const [sourcesError, setSourcesError] = useState<string | null>(null);

  async function loadSources() {
    try {
      setIsLoadingSources(true);
      setSourcesError(null);
      const response = await listSources();
      startTransition(() => {
        setSources(response.sources);
      });
    } catch (error) {
      setSourcesError(
        error instanceof Error ? error.message : "Could not load ingested documents.",
      );
    } finally {
      setIsLoadingSources(false);
    }
  }

  async function handleUpload() {
    if (!selectedFile) {
      return;
    }

    try {
      setUploadState({ status: "uploading" });
      const response = await uploadDocument(selectedFile);
      setUploadState({ status: "success", response });
      setSelectedFile(null);

      if (inputRef.current) {
        inputRef.current.value = "";
      }

      await loadSources();
      router.push("/chat");
    } catch (error) {
      setUploadState({
        status: "error",
        message:
          error instanceof Error ? error.message : "The upload failed unexpectedly.",
      });
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-2">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            Curate your source set
          </h2>
          <p className="text-sm leading-7 text-slate-600 dark:text-slate-400">
            Drop in PDFs, TXT files, or DOCX notes. Each upload is chunked and added
            to your searchable reference library automatically.
          </p>
        </div>
      </div>

      <div className="rounded-[30px] border border-slate-200/80 bg-white/70 p-5 shadow-[0_14px_40px_rgba(118,133,160,0.10)] dark:border-slate-800 dark:bg-slate-900/80">
        <label
          htmlFor="document-upload"
          className="mb-3 block text-sm font-medium text-slate-800 dark:text-slate-100"
        >
          Choose a document
        </label>
        <input
          ref={inputRef}
          id="document-upload"
          type="file"
          accept=".pdf,.txt,.docx"
          onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
          className="block w-full rounded-3xl border border-dashed border-slate-300 bg-[#f9f6f0] px-4 py-5 h-80 text-sm text-slate-600 file:mr-4 file:rounded-full file:border-0 file:bg-indigo-500/12 file:px-4 file:py-2 file:text-sm file:font-medium file:text-indigo-700 hover:file:bg-indigo-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:file:bg-blue-500/20 dark:file:text-blue-200"
        />

        {selectedFile ? (
          <div className="mt-4 rounded-3xl border border-indigo-200 bg-indigo-50/80 px-4 py-3">
            <p className="truncate text-sm font-medium text-indigo-900">
              {selectedFile.name}
            </p>
            <p className="font-technical mt-1 text-xs text-indigo-700/80">
              {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
            </p>
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => void handleUpload()}
          disabled={!selectedFile || uploadState.status === "uploading"}
          className="mt-4 inline-flex h-12 w-full items-center justify-center rounded-[22px] bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
        >
          {uploadState.status === "uploading" ? "Uploading..." : "Upload document"}
        </button>

        {uploadState.status === "uploading" ? (
          <div className="mt-4 space-y-2">
            <div className="h-2 overflow-hidden rounded-full bg-slate-200">
              <div className="h-full w-2/3 animate-pulse rounded-full bg-indigo-500" />
            </div>
            <p className="font-technical text-xs text-slate-500">
              Processing your file and preparing the source index.
            </p>
          </div>
        ) : null}

        {uploadState.status === "success" ? (
          <div className="mt-4 rounded-3xl border border-emerald-200 bg-emerald-50/90 px-4 py-3 text-sm text-emerald-900">
            <p className="font-medium">{uploadState.response.filename} ingested successfully.</p>
            <p className="mt-1 text-emerald-700/90">
              {uploadState.response.chunk_count} chunks created in{" "}
              {uploadState.response.collection_name}.
            </p>
          </div>
        ) : null}

        {uploadState.status === "error" ? (
          <div className="mt-4 rounded-3xl border border-rose-200 bg-rose-50/90 px-4 py-3 text-sm text-rose-900">
            {uploadState.message}
          </div>
        ) : null}
      </div>

      <div className="flex min-h-105 flex-col rounded-[30px] border border-slate-200/80 bg-white/65 shadow-[0_14px_40px_rgba(118,133,160,0.08)] dark:border-slate-800 dark:bg-slate-900/75">
        <div className="flex items-center justify-between gap-4 border-b border-slate-200/70 px-5 py-4 dark:border-slate-800">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Your library</h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Previously ingested documents ready for retrieval.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadSources()}
            className="rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 text-xs text-slate-600 transition hover:border-indigo-200 hover:text-indigo-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-blue-400 dark:hover:text-blue-300"
          >
            Refresh
          </button>
        </div>

        <div className="scrollbar-subtle min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {isLoadingSources ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={index}
                  className="h-20 animate-pulse rounded-3xl border border-slate-200/60 bg-white/70 dark:border-slate-800 dark:bg-slate-900"
                />
              ))}
            </div>
          ) : sourcesError ? (
            <div className="rounded-3xl border border-rose-200 bg-rose-50/90 px-4 py-3 text-sm text-rose-900">
              {sourcesError}
            </div>
          ) : sources.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-[#faf7f1] px-4 py-6 text-sm leading-7 text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400">
              No documents have been ingested yet. Upload one to populate the knowledge base.
            </div>
          ) : (
            <ul className="space-y-3">
              {sources.map((source) => (
                <li
                  key={`${source.collection_name}-${source.source}`}
                  className="rounded-3xl border border-slate-200/80 bg-white/85 px-4 py-3 shadow-[0_8px_24px_rgba(130,145,160,0.08)] dark:border-slate-800 dark:bg-slate-950/90"
                >s
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                        {source.source}
                      </p>
                      <p className="font-technical mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {source.collection_name}
                      </p>
                    </div>
                    <span className="font-technical rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[11px] text-indigo-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300">
                      {source.chunk_count} chunks
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
