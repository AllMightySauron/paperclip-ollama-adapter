export const ADAPTER_TYPE = "ollama_local";
export const DEFAULT_BASE_URL = "http://127.0.0.1:11434";
export const DEFAULT_TIMEOUT_SEC = 120;
export const OLLAMA_THINK_LEVELS = ["low", "medium", "high"] as const;

export type OllamaThinkLevel = typeof OLLAMA_THINK_LEVELS[number];
export type OllamaThinking = boolean | OllamaThinkLevel;

export interface OllamaAdapterConfig {
  model: string;
  baseUrl: string;
  timeoutSec: number;
  logging?: boolean;
  think?: OllamaThinking;
  instructions?: string;
  promptTemplate?: string;
}

export interface OllamaSessionParams {
  sessionId: string;
  model: string;
  createdAt: string;
  updatedAt: string;
  metadata: OllamaSessionMetadata;
}

export interface OllamaSessionMetadata {
  endpoint?: string;
  lastCreatedAt?: string | null;
  doneReason?: string | null;
}

export interface OllamaInvocationRequest {
  baseUrl: string;
  model: string;
  prompt: string;
  instructions?: string;
  think?: OllamaThinking;
  timeoutMs: number;
  session: OllamaSessionParams | null;
  logging?: boolean;
  onLog?: OllamaLogFn;
}

export type OllamaLogFn = (stream: "stdout" | "stderr", chunk: string) => Promise<void>;

export interface OllamaChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface OllamaChatRequestBody {
  model: string;
  messages: OllamaChatMessage[];
  stream: boolean;
  think?: OllamaThinking;
}

export interface OllamaInvocationResult {
  success: boolean;
  timedOut: boolean;
  summary: string | null;
  model: string;
  responseText?: string;
  error?: string;
  errorCode?: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens?: number;
  };
  costUsd: number | null;
  session: OllamaSessionParams | null;
  raw: Record<string, unknown>;
}
