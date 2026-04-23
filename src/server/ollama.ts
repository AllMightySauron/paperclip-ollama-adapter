import type {
  OllamaChatRequestBody,
  OllamaChatMessage,
  OllamaInvocationRequest,
  OllamaInvocationResult,
  OllamaToolCall,
  OllamaToolDefinition
} from "../types.js";
import {
  parseRunCommandInput,
  runTrustedCommand,
  type RunCommandOutput
} from "./commands.js";
import { createPlaceholderSession } from "./session.js";

export const OLLAMA_CHAT_PATH = "/api/chat";
const RUN_COMMAND_TOOL_NAME = "run_command";

/**
 * Runs one Paperclip invocation against Ollama's `/api/chat` endpoint.
 *
 * When command execution is enabled, this method drives Ollama's native
 * `message.tool_calls` loop: send chat request, execute requested commands,
 * append tool results, and ask Ollama for the next assistant turn. Textual
 * tool-call formats are intentionally ignored because Paperclip can only act
 * safely on structured tool calls.
 */
export async function invokeOllama(
  request: OllamaInvocationRequest
): Promise<OllamaInvocationResult> {
  const session = request.session ?? createPlaceholderSession(request.model);
  const chatUrl = buildOllamaApiUrl(request.baseUrl, OLLAMA_CHAT_PATH);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), request.timeoutMs);
  const messages = buildInitialMessages(request);
  const rawResponses: unknown[] = [];
  const toolResults: RunCommandOutput[] = [];
  let executedToolCalls = 0;
  const usage = {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0
  };

  try {
    const maxTurns = request.commandExecution?.enabled
      ? request.commandExecution.maxToolCalls + 1
      : 1;

    for (let turn = 0; turn < maxTurns; turn += 1) {
      const body = buildOllamaChatRequestBody(request, messages);
      await logOllama(request, "stdout", "Sending Ollama chat request", {
        endpoint: chatUrl,
        timeoutMs: request.timeoutMs,
        turn,
        requestBody: body,
        session: request.session
          ? {
              sessionId: request.session.sessionId,
              model: request.session.model,
              updatedAt: request.session.updatedAt
            }
          : null
      });

      const response = await fetch(chatUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body),
        signal: controller.signal
      });

      const payload = await readJsonResponse(response);
      rawResponses.push(payload);
      await logOllama(request, response.ok ? "stdout" : "stderr", "Received Ollama chat response", {
        endpoint: chatUrl,
        status: response.status,
        ok: response.ok,
        turn,
        response: payload
      });

      if (!response.ok) {
        const message = readOllamaError(payload)
          ?? `Ollama chat request failed with HTTP ${response.status}`;

        const failure = buildFailureResult({
          request,
          session,
          error: message,
          errorCode: "ollama_http_error",
          raw: {
            endpoint: chatUrl,
            status: response.status,
            response: payload,
            responses: rawResponses,
            toolResults
          }
        });
        await logOllama(request, "stderr", "Ollama chat request failed", {
          error: failure.error,
          errorCode: failure.errorCode
        });
        return failure;
      }

      addUsage(usage, readUsage(readRecord(payload)));

      const record = readRecord(payload);
      const assistantMessage = readAssistantMessage(record);
      const toolCalls = assistantMessage.tool_calls ?? [];
      if (toolCalls.length === 0) {
        const result = buildSuccessResult(request, session, payload, chatUrl, {
          usage,
          raw: {
            endpoint: chatUrl,
            responses: rawResponses,
            toolResults,
            finalResponse: readRecord(payload)
          }
        });
        await logOllama(request, "stdout", "Parsed Ollama chat result", {
          model: result.model,
          usage: result.usage,
          responseText: result.responseText ?? "",
          sessionParams: result.session
        });
        return result;
      }

      if (!request.commandExecution?.enabled) {
        return buildFailureResult({
          request,
          session,
          error: "Ollama requested tool calls, but command execution is disabled",
          errorCode: "tool_calls_disabled",
          raw: {
            endpoint: chatUrl,
            responses: rawResponses,
            toolCalls
          }
        });
      }

      if (executedToolCalls + toolCalls.length > request.commandExecution.maxToolCalls) {
        const failure = buildFailureResult({
          request,
          session,
          error: `Exceeded maxToolCalls (${request.commandExecution.maxToolCalls})`,
          errorCode: "max_tool_calls_exceeded",
          raw: {
            endpoint: chatUrl,
            responses: rawResponses,
            toolResults,
            requestedToolCalls: toolCalls
          }
        });
        await logOllama(request, "stderr", "Ollama tool loop stopped", {
          error: failure.error,
          errorCode: failure.errorCode
        });
        return failure;
      }

      messages.push(assistantMessage);
      for (const toolCall of toolCalls) {
        const toolResult = await executeToolCall(request, toolCall);
        executedToolCalls += 1;
        toolResults.push(toolResult);
        messages.push({
          role: "tool",
          tool_name: RUN_COMMAND_TOOL_NAME,
          content: JSON.stringify(toolResult)
        });
      }
    }

    const failure = buildFailureResult({
      request,
      session,
      error: `Exceeded maxToolCalls (${request.commandExecution?.maxToolCalls ?? 0})`,
      errorCode: "max_tool_calls_exceeded",
      raw: {
        endpoint: chatUrl,
        responses: rawResponses,
        toolResults
      }
    });
    await logOllama(request, "stderr", "Ollama tool loop stopped", {
      error: failure.error,
      errorCode: failure.errorCode
    });
    return failure;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      const failure = buildFailureResult({
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
      await logOllama(request, "stderr", "Ollama chat request timed out", {
        error: failure.error,
        errorCode: failure.errorCode
      });
      return failure;
    }

    const failure = buildFailureResult({
      request,
      session,
      error: err instanceof Error ? err.message : String(err),
      errorCode: "ollama_request_failed",
      raw: {
        endpoint: chatUrl
      }
    });
    await logOllama(request, "stderr", "Ollama chat request threw", {
      error: failure.error,
      errorCode: failure.errorCode
    });
    return failure;
  } finally {
    clearTimeout(timeout);
  }
}

/** Builds the exact JSON payload sent to Ollama. Exported for contract tests. */
export function buildOllamaChatRequestBody(
  request: OllamaInvocationRequest,
  messages = buildInitialMessages(request)
): OllamaChatRequestBody {
  return {
    model: request.model,
    messages,
    stream: false,
    ...(request.think !== undefined ? { think: request.think } : {}),
    ...(request.commandExecution?.enabled ? { tools: [runCommandTool] } : {})
  };
}

/** Converts adapter instructions and rendered prompt into Ollama chat messages. */
function buildInitialMessages(request: OllamaInvocationRequest): OllamaChatMessage[] {
  return [
    ...(request.instructions
      ? [{ role: "system" as const, content: request.instructions }]
      : []),
    { role: "user", content: request.prompt }
  ];
}

/**
 * Native command tool exposed to Ollama-compatible models.
 *
 * The schema is deliberately compact. Some Ollama cloud/model combinations have
 * been sensitive to verbose tool descriptions, so detailed examples live in the
 * prompt while this schema keeps the machine contract concise.
 */
const runCommandTool: OllamaToolDefinition = {
  type: "function",
  function: {
    name: RUN_COMMAND_TOOL_NAME,
    description: "Run a trusted local command. Prefer command plus args; use sh -lc for shell syntax.",
    parameters: {
      type: "object",
      required: ["command"],
      properties: {
        command: {
          type: "string",
          description: "Executable name or path, for example cat, ls, npm, node, git, sh, or ./scripts/test.sh."
        },
        args: {
          type: "array",
          description: "Arguments as separate strings. Example: command cat with args [file.md], or command ls with args [-R, path].",
          items: { type: "string" }
        },
        cwd: {
          type: "string",
          description: "Optional absolute working directory. Defaults to adapter commandCwd."
        },
        stdin: {
          type: "string",
          description: "Optional stdin content to send to the process."
        }
      }
    }
  }
};

/** Reads JSON while surfacing provider responses that are not valid JSON. */
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

/** Maps a successful Ollama response into Paperclip's provider-neutral result. */
function buildSuccessResult(
  request: OllamaInvocationRequest,
  session: ReturnType<typeof createPlaceholderSession>,
  payload: unknown,
  endpoint: string,
  overrides?: {
    usage?: OllamaInvocationResult["usage"];
    raw?: Record<string, unknown>;
  }
): OllamaInvocationResult {
  const record = readRecord(payload);
  const responseText = readMessageContent(record);
  const usage = overrides?.usage ?? readUsage(record);
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
    raw: overrides?.raw ?? readRecord(payload)
  };
}

/** Creates a failed invocation result while preserving raw provider context. */
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

function addUsage(
  total: { inputTokens: number; outputTokens: number; totalTokens: number },
  next: OllamaInvocationResult["usage"]
): void {
  total.inputTokens += next.inputTokens;
  total.outputTokens += next.outputTokens;
  total.totalTokens += next.totalTokens ?? next.inputTokens + next.outputTokens;
}

function readAssistantMessage(record: Record<string, unknown>): OllamaChatMessage {
  const message = readRecord(record.message);
  const content = readString(message.content) ?? "";
  return {
    role: "assistant",
    content,
    ...(Array.isArray(message.tool_calls) ? { tool_calls: message.tool_calls as OllamaToolCall[] } : {})
  };
}

/** Executes one supported native tool call and returns the result as JSON data. */
async function executeToolCall(
  request: OllamaInvocationRequest,
  toolCall: OllamaToolCall
): Promise<RunCommandOutput> {
  const name = toolCall.function?.name;
  if (name !== RUN_COMMAND_TOOL_NAME) {
    throw new Error(`Unsupported tool call: ${name ?? "unknown"}`);
  }
  if (!request.commandExecution || !request.runId || !request.onLog) {
    throw new Error("Command execution requires runId, onLog, and commandExecution options");
  }

  const input = parseRunCommandInput(toolCall.function?.arguments);
  await logOllama(request, "stdout", "Executing tool call", {
    name,
    arguments: input
  });

  const result = await runTrustedCommand(input, {
    runId: request.runId,
    defaultCwd: request.commandExecution.cwd,
    timeoutSec: request.commandExecution.timeoutSec,
    onLog: request.onLog,
    ...(request.onSpawn ? { onSpawn: request.onSpawn } : {})
  });

  await logOllama(request, "stdout", "Tool call completed", {
    command: result.command,
    args: result.args,
    cwd: result.cwd,
    exitCode: result.exitCode,
    signal: result.signal,
    timedOut: result.timedOut
  });

  return result;
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

async function logOllama(
  request: OllamaInvocationRequest,
  stream: "stdout" | "stderr",
  message: string,
  data: Record<string, unknown>
): Promise<void> {
  if (!request.logging || !request.onLog) {
    return;
  }

  await request.onLog(stream, `[ollama:debug] ${message}\n${JSON.stringify(data, null, 2)}\n`);
}

/** Discovers locally available Ollama model names via `/api/tags`. */
export async function listOllamaModels(baseUrl: string): Promise<string[]> {
  const tagsUrl = buildOllamaApiUrl(baseUrl, "/api/tags");
  const response = await fetch(tagsUrl, { method: "GET" });

  if (!response.ok) {
    throw new Error(`Ollama model discovery failed with HTTP ${response.status}`);
  }

  const payload = await response.json() as unknown;
  return parseOllamaTagsResponse(payload);
}

/** Joins a configured Ollama root URL and API path without duplicating slashes. */
export function buildOllamaApiUrl(baseUrl: string, path: string): string {
  const prefix = baseUrl.replace(/\/+$/, "");
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${prefix}${suffix}`;
}

/** Parses the two common model-name fields returned by Ollama `/api/tags`. */
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
