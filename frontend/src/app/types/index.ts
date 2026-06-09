export type SourceDocument = {
  source: string;
  chunk_count: number;
  collection_name: string;
};

export type SourceListResponse = {
  sources: SourceDocument[];
  total: number;
};

export type IngestResponse = {
  success: boolean;
  filename: string;
  file_type: string;
  chunk_count: number;
  collection_name: string;
  message: string;
};

export type QuestionRequest = {
  question: string;
  provider?: "groq" | "gemini" | "mistral";
  collection_name?: string;
};

export type SourceChunk = {
  content: string;
  source: string;
  page: number | null;
  score: number | null;
};

export type StreamMetadata = {
  provider: string;
  model: string;
  sources: SourceChunk[];
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  status: "done" | "streaming" | "error";
  sources: SourceChunk[];
  provider?: string;
  model?: string;
  error?: string;
};
