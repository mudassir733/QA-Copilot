"use client";

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
    } catch (error) {
      setUploadState({
        status: "error",
        message:
          error instanceof Error ? error.message : "The upload failed unexpectedly.",
      });
    }
  }

  return (
    <div className="flex h-full flex-col gap-6">
      <div className="space-y-2">
        <p className="font-technical text-xs uppercase tracking-[0.26em] text-indigo-300/80">
          Document Upload
        </p>
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight text-white">
            Ingest source material
          </h2>
          <p className="text-sm leading-7 text-slate-300">
            Add a PDF, TXT, or DOCX document to your knowledge base. The backend will
            split it into chunks and store searchable embeddings.
          </p>
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/3 p-4">
        <label
          htmlFor="document-upload"
          className="mb-3 block text-sm font-medium text-slate-100"
        >
          Choose a document
        </label>
        <input
          ref={inputRef}
          id="document-upload"
          type="file"
          accept=".pdf,.txt,.docx"
          onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
          className="block w-full rounded-2xl border border-dashed border-white/15 bg-slate-950/40 px-4 py-5 text-sm text-slate-300 file:mr-4 file:rounded-full file:border-0 file:bg-indigo-500/15 file:px-4 file:py-2 file:text-sm file:font-medium file:text-indigo-200 hover:file:bg-indigo-500/25"
        />

        {selectedFile ? (
          <div className="mt-4 rounded-2xl border border-indigo-400/15 bg-indigo-500/8 px-4 py-3">
            <p className="truncate text-sm font-medium text-indigo-100">
              {selectedFile.name}
            </p>
            <p className="font-technical mt-1 text-xs text-indigo-200/80">
              {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
            </p>
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => void handleUpload()}
          disabled={!selectedFile || uploadState.status === "uploading"}
          className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-2xl bg-indigo-500 px-4 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:bg-indigo-500/30 disabled:text-slate-300"
        >
          {uploadState.status === "uploading" ? "Uploading..." : "Upload document"}
        </button>

        {uploadState.status === "uploading" ? (
          <div className="mt-4 space-y-2">
            <div className="h-2 overflow-hidden rounded-full bg-slate-900/80">
              <div className="h-full w-2/3 animate-pulse rounded-full bg-indigo-400" />
            </div>
            <p className="font-technical text-xs text-slate-400">
              Sending file to /ingest/upload and waiting for chunking to finish.
            </p>
          </div>
        ) : null}

        {uploadState.status === "success" ? (
          <div className="mt-4 rounded-2xl border border-emerald-400/20 bg-emerald-500/8 px-4 py-3 text-sm text-emerald-100">
            <p className="font-medium">{uploadState.response.filename} ingested successfully.</p>
            <p className="mt-1 text-emerald-100/80">
              {uploadState.response.chunk_count} chunks created in{" "}
              {uploadState.response.collection_name}.
            </p>
          </div>
        ) : null}

        {uploadState.status === "error" ? (
          <div className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-500/8 px-4 py-3 text-sm text-rose-100">
            {uploadState.message}
          </div>
        ) : null}
      </div>

      <div className="flex min-h-0 flex-1 flex-col rounded-3xl border border-white/10 bg-white/3">
        <div className="flex items-center justify-between gap-4 border-b border-white/8 px-4 py-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-100">Indexed sources</h3>
            <p className="font-technical mt-1 text-xs text-slate-400">
              GET /ingest/sources
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadSources()}
            className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-slate-300 transition hover:border-indigo-400/30 hover:text-white"
          >
            Refresh
          </button>
        </div>

        <div className="scrollbar-subtle min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {isLoadingSources ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={index}
                  className="h-20 animate-pulse rounded-2xl border border-white/6 bg-white/4"
                />
              ))}
            </div>
          ) : sourcesError ? (
            <div className="rounded-2xl border border-rose-400/20 bg-rose-500/8 px-4 py-3 text-sm text-rose-100">
              {sourcesError}
            </div>
          ) : sources.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-sm leading-7 text-slate-400">
              No documents have been ingested yet. Upload one to populate the knowledge base.
            </div>
          ) : (
            <ul className="space-y-3">
              {sources.map((source) => (
                <li
                  key={`${source.collection_name}-${source.source}`}
                  className="rounded-2xl border border-white/8 bg-slate-950/35 px-4 py-3"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-100">
                        {source.source}
                      </p>
                      <p className="font-technical mt-1 text-xs text-slate-400">
                        {source.collection_name}
                      </p>
                    </div>
                    <span className="font-technical rounded-full border border-indigo-400/20 bg-indigo-500/10 px-2.5 py-1 text-[11px] text-indigo-200">
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
