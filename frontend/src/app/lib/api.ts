import type {
  IngestResponse,
  QuestionRequest,
  SourceListResponse,
  StreamMetadata,
} from "@/app/types";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

function getErrorMessage(status: number, payload: string) {
  try {
    const parsed = JSON.parse(payload) as { detail?: string };
    if (parsed.detail) {
      return parsed.detail;
    }
  } catch {}

  return payload || `Request failed with status ${status}.`;
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const payload = await response.text();
    throw new Error(getErrorMessage(response.status, payload));
  }

  return (await response.json()) as T;
}

export async function uploadDocument(file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE_URL}/ingest/upload`, {
    method: "POST",
    body: formData,
  });

  return parseJsonResponse<IngestResponse>(response);
}

export async function listSources() {
  const response = await fetch(`${API_BASE_URL}/ingest/sources`, {
    cache: "no-store",
  });

  return parseJsonResponse<SourceListResponse>(response);
}

type StreamCallbacks = {
  onToken: (token: string) => void;
  onComplete: (metadata: StreamMetadata) => void;
};

export async function streamAnswer(
  payload: QuestionRequest,
  callbacks: StreamCallbacks,
  signal?: AbortSignal,
) {
  const response = await fetch(`${API_BASE_URL}/chat/ask/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify(payload),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(getErrorMessage(response.status, errorText));
  }

  if (!response.body) {
    throw new Error("Streaming is not available in this browser.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let metadata: StreamMetadata | null = null;

  const consumeEvent = (rawEvent: string) => {
    if (!rawEvent.startsWith("data:")) {
      return;
    }

    const rawData = rawEvent.startsWith("data: ")
      ? rawEvent.slice(6)
      : rawEvent.slice(5);
    const controlData = rawData.trimStart();

    if (controlData.startsWith("[ERROR]")) {
      throw new Error(controlData.slice(7).trim() || "The backend stream failed.");
    }

    if (controlData.startsWith("[DONE]")) {
      metadata = JSON.parse(controlData.slice(6)) as StreamMetadata;
      return;
    }

    callbacks.onToken(rawData);
  };

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });

    while (true) {
      const boundary = buffer.indexOf("\n\n");
      if (boundary === -1) {
        break;
      }

      const rawEvent = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      consumeEvent(rawEvent);
    }
  }

  buffer += decoder.decode();

  if (buffer.trim()) {
    consumeEvent(buffer.trimEnd());
  }

  callbacks.onComplete(
    metadata ?? {
      provider: "unknown",
      model: "unknown",
      sources: [],
    },
  );
}
