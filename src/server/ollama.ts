import type {
  OllamaChatRequestBody,
  OllamaInvocationRequest,
  OllamaInvocationResult
} from "../types.js";
import { createPlaceholderSession } from "./session.js";

export const OLLAMA_CHAT_PATH = "/api/chat";

export async function invokeOllama(
  request: OllamaInvocationRequest
): Promise<OllamaInvocationResult> {
  const session = request.session ?? createPlaceholderSession(request.model);
  const chatUrl = buildOllamaApiUrl(request.baseUrl, OLLAMA_CHAT_PATH);
  const body = buildOllamaChatRequestBody(request);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), request.timeoutMs);

  try {
    const response = await fetch(chatUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });

    const payload = await readJsonResponse(response);

    if (!response.ok) {
      const message = readOllamaError(payload)
        ?? `Ollama chat request failed with HTTP ${response.status}`;

      return buildFailureResult({
        request,
        session,
        error: message,
        errorCode: "ollama_http_error",
        raw: {
          endpoint: chatUrl,
          status: response.status,
          response: payload
        }
      });
    }

    return buildSuccessResult(request, session, payload, chatUrl);
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return buildFailureResult({
        request,
        session,
        error: `Ollama chat request timed out after ${request.timeoutMs}ms`,
        errorCode: "timeout",
        timedOut: true,
        raw: {
          endpoint: chatUrl,
          timeoutMs: request.timeoutMs
        }
      });
    }

    return buildFailureResult({
      request,
      session,
      error: err instanceof Error ? err.message : String(err),
      errorCode: "ollama_request_failed",
      raw: {
        endpoint: chatUrl
      }
    });
  } finally {
    clearTimeout(timeout);
  }
}

export function buildOllamaChatRequestBody(
  request: OllamaInvocationRequest
): OllamaChatRequestBody {
  return {
    model: request.model,
    messages: [
      ...(request.instructions
        ? [{ role: "system" as const, content: request.instructions }]
        : []),
      { role: "user", content: request.prompt }
    ],
    stream: false,
    ...(request.think !== undefined ? { think: request.think } : {})
  };
}

async function readJsonResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text.trim() === "") {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error("Ollama returned invalid JSON");
  }
}

function buildSuccessResult(
  request: OllamaInvocationRequest,
  session: ReturnType<typeof createPlaceholderSession>,
  payload: unknown,
  endpoint: string
): OllamaInvocationResult {
  const record = readRecord(payload);
  const responseText = readMessageContent(record);
  const usage = readUsage(record);
  const updatedSession = {
    ...session,
    model: request.model,
    updatedAt: new Date().toISOString(),
    metadata: {
      endpoint,
      lastCreatedAt: readString(record.created_at) ?? null,
      doneReason: readString(record.done_reason) ?? null
    }
  };

  return {
    success: true,
    timedOut: false,
    summary: summarizeResponse(responseText),
    model: readString(record.model) ?? request.model,
    responseText,
    usage,
    costUsd: 0,
    session: updatedSession,
    raw: readRecord(payload)
  };
}

function buildFailureResult(args: {
  request: OllamaInvocationRequest;
  session: ReturnType<typeof createPlaceholderSession>;
  error: string;
  errorCode: string;
  raw: Record<string, unknown>;
  timedOut?: boolean;
}): OllamaInvocationResult {
  return {
    success: false,
    timedOut: args.timedOut ?? false,
    summary: null,
    model: args.request.model,
    error: args.error,
    errorCode: args.errorCode,
    usage: {
      inputTokens: 0,
      outputTokens: 0
    },
    costUsd: 0,
    session: {
      ...args.session,
      updatedAt: new Date().toISOString()
    },
    raw: args.raw
  };
}

function readOllamaError(payload: unknown): string | null {
  const record = readRecord(payload);
  return readString(record.error);
}

function readMessageContent(record: Record<string, unknown>): string {
  const message = record.message;
  if (typeof message !== "object" || message === null) {
    return "";
  }

  return readString((message as Record<string, unknown>).content) ?? "";
}

function readUsage(record: Record<string, unknown>): OllamaInvocationResult["usage"] {
  const inputTokens = readNumber(record.prompt_eval_count) ?? 0;
  const outputTokens = readNumber(record.eval_count) ?? 0;

  return {
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens
  };
}

function summarizeResponse(responseText: string): string {
  const trimmed = responseText.trim();
  if (trimmed.length <= 240) {
    return trimmed;
  }

  return `${trimmed.slice(0, 237)}...`;
}

function readRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? value as Record<string, unknown>
    : {};
}

function readString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function readNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export async function listOllamaModels(baseUrl: string): Promise<string[]> {
  const tagsUrl = buildOllamaApiUrl(baseUrl, "/api/tags");
  const response = await fetch(tagsUrl, { method: "GET" });

  if (!response.ok) {
    throw new Error(`Ollama model discovery failed with HTTP ${response.status}`);
  }

  const payload = await response.json() as unknown;
  return parseOllamaTagsResponse(payload);
}

export function buildOllamaApiUrl(baseUrl: string, path: string): string {
  const prefix = baseUrl.replace(/\/+$/, "");
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${prefix}${suffix}`;
}

export function parseOllamaTagsResponse(payload: unknown): string[] {
  if (typeof payload !== "object" || payload === null) {
    throw new Error("Ollama /api/tags response must be an object");
  }

  const models = (payload as { models?: unknown }).models;
  if (!Array.isArray(models)) {
    throw new Error("Ollama /api/tags response is missing a models array");
  }

  return models
    .map((model) => {
      if (typeof model !== "object" || model === null) {
        return null;
      }

      const record = model as { name?: unknown; model?: unknown };
      if (typeof record.name === "string" && record.name.trim() !== "") {
        return record.name;
      }
      if (typeof record.model === "string" && record.model.trim() !== "") {
        return record.model;
      }
      return null;
    })
    .filter((name): name is string => name !== null);
}
