"use client";

import { useRouter } from "next/navigation";
import { startTransition, useEffect, useMemo, useRef, useState } from "react";

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
  const [textPreview, setTextPreview] = useState<string>("");
  const [uploadState, setUploadState] = useState<UploadState>({ status: "idle" });
  const [sources, setSources] = useState<SourceDocument[]>(initialSources);
  const [isLoadingSources, setIsLoadingSources] = useState(false);
  const [sourcesError, setSourcesError] = useState<string | null>(null);
  const filePreviewUrl = useMemo(() => {
    if (!selectedFile) {
      return null;
    }

    return URL.createObjectURL(selectedFile);
  }, [selectedFile]);

  useEffect(() => {
    return () => {
      if (filePreviewUrl) {
        URL.revokeObjectURL(filePreviewUrl);
      }
    };
  }, [filePreviewUrl]);

  async function handleFileChange(file: File | null) {
    setSelectedFile(file);

    if (!file || !file.name.toLowerCase().endsWith(".txt")) {
      setTextPreview("");
      return;
    }

    try {
      const content = await file.text();
      setTextPreview(content.slice(0, 1500));
    } catch {
      setTextPreview("");
    }
  }

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

      <div className="rounded-md border border-slate-200/80 bg-white/70 p-5 shadow-[0_14px_40px_rgba(118,133,160,0.10)] dark:border-slate-800 dark:bg-[#121212]">
        <label
          htmlFor="document-upload"
          className="mb-3 block text-sm font-medium text-slate-800 dark:text-slate-100"
        >
          Choose a document
        </label>

        <div className="flex h-80 items-center justify-center rounded-md border-2 border-dashed border-slate-300 bg-white p-6 text-center dark:border-slate-700 dark:bg-[#121212]">
          <div className="space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-md bg-indigo-500/10 text-indigo-600 dark:bg-blue-500/15 dark:text-blue-300">
              <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M12 16V4" />
                <path d="M7.5 8.5 12 4l4.5 4.5" />
                <path d="M4 16.5v1.5A2 2 0 0 0 6 20h12a2 2 0 0 0 2-2v-1.5" />
              </svg>
            </div>
            <div className="space-y-2">
              <p className="text-base font-medium text-slate-800 dark:text-slate-100">
                Select a file to preview and upload
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Supported formats: PDF, TXT, DOCX
              </p>
            </div>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="inline-flex h-12 items-center justify-center rounded-md border border-indigo-200 bg-white px-6 text-sm font-semibold text-indigo-700 transition hover:bg-[#edf3ff] dark:border-blue-500/30 dark:bg-[#121212] dark:text-blue-300 dark:hover:bg-blue-500/10"
            >
              Choose File
            </button>
            <input
              ref={inputRef}
              id="document-upload"
              type="file"
              accept=".pdf,.txt,.docx"
              onChange={(event) => void handleFileChange(event.target.files?.[0] ?? null)}
              className="hidden"
            />
          </div>
        </div>

        {selectedFile ? (
          <div className="mt-4 space-y-4 rounded-md border border-indigo-200 bg-[#edf3ff] p-4 dark:border-blue-500/20 dark:bg-blue-500/10">
            <div>
              <p className="truncate text-sm font-medium text-indigo-900 dark:text-blue-100">
                {selectedFile.name}
              </p>
              <p className="font-technical mt-1 text-xs text-indigo-700/80 dark:text-blue-300/80">
                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>

            {selectedFile.name.toLowerCase().endsWith(".pdf") && filePreviewUrl ? (
              <iframe
                src={filePreviewUrl}
                title={selectedFile.name}
                className="h-72 w-full rounded-md border border-indigo-200 bg-white dark:border-blue-500/20 dark:bg-[#121212]"
              />
            ) : null}

            {selectedFile.name.toLowerCase().endsWith(".txt") ? (
              <pre className="font-technical max-h-72 overflow-auto whitespace-pre-wrap rounded-md border border-indigo-200 bg-white p-4 text-xs leading-6 text-slate-700 dark:border-blue-500/20 dark:bg-[#121212] dark:text-slate-300">
                {textPreview || "Loading text preview..."}
              </pre>
            ) : null}

            {selectedFile.name.toLowerCase().endsWith(".docx") ? (
              <div className="flex min-h-40 items-center justify-center rounded-md border border-indigo-200 bg-white px-4 py-6 text-center dark:border-blue-500/20 dark:bg-[#121212]">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                    DOCX preview ready
                  </p>
                  <p className="text-xs leading-6 text-slate-500 dark:text-slate-400">
                    {selectedFile.name} is selected and ready to upload.
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => void handleUpload()}
          disabled={!selectedFile || uploadState.status === "uploading"}
          className="mt-4 inline-flex h-12 w-full items-center justify-center rounded-md bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
        >
          {uploadState.status === "uploading" ? "Uploading..." : "Upload document"}
        </button>

        {uploadState.status === "uploading" ? (
          <div className="mt-4 space-y-2">
            <div className="h-2 overflow-hidden rounded-md bg-slate-200">
              <div className="h-full w-2/3 animate-pulse rounded-md bg-indigo-500" />
            </div>
            <p className="font-technical text-xs text-slate-500">
              Processing your file and preparing the source index.
            </p>
          </div>
        ) : null}

        {uploadState.status === "success" ? (
          <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50/90 px-4 py-3 text-sm text-emerald-900">
            <p className="font-medium">{uploadState.response.filename} ingested successfully.</p>
            <p className="mt-1 text-emerald-700/90">
              {uploadState.response.chunk_count} chunks created in{" "}
              {uploadState.response.collection_name}.
            </p>
          </div>
        ) : null}

        {uploadState.status === "error" ? (
          <div className="mt-4 rounded-md border border-rose-200 bg-rose-50/90 px-4 py-3 text-sm text-rose-900">
            {uploadState.message}
          </div>
        ) : null}
      </div>

      <div className="flex min-h-105 flex-col rounded-md border border-slate-200/80 bg-white/65 shadow-[0_14px_40px_rgba(118,133,160,0.08)] dark:border-slate-800 dark:bg-[#121212]">
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
            className="rounded-md border border-slate-200 bg-white/80 px-3 py-1.5 text-xs text-slate-600 transition hover:border-indigo-200 hover:text-indigo-700 dark:border-slate-700 dark:bg-[#121212] dark:text-slate-300 dark:hover:border-blue-400 dark:hover:text-blue-300"
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
                  className="h-20 animate-pulse rounded-md border border-slate-200/60 bg-white/70 dark:border-slate-800 dark:bg-[#121212]"
                />
              ))}
            </div>
          ) : sourcesError ? (
            <div className="rounded-md border border-rose-200 bg-rose-50/90 px-4 py-3 text-sm text-rose-900">
              {sourcesError}
            </div>
          ) : sources.length === 0 ? (
            <div className="rounded-md border border-dashed border-slate-300 bg-white px-4 py-6 text-sm leading-7 text-slate-500 dark:border-slate-700 dark:bg-[#121212] dark:text-slate-400">
              No documents have been ingested yet. Upload one to populate the knowledge base.
            </div>
          ) : (
            <ul className="space-y-3">
              {sources.map((source) => (
                <li
                  key={`${source.collection_name}-${source.source}`}
                  className="rounded-md border border-slate-200/80 bg-white/85 px-4 py-3 
                   dark:border-slate-800 dark:bg-[#121212]"
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
                    <span className="font-technical rounded-md border border-indigo-200 bg-[#edf3ff] px-2.5 py-1 text-[11px] text-indigo-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300">
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
