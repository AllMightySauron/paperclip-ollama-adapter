export const ADAPTER_TYPE = "ollama_local";
export const DEFAULT_BASE_URL = "http://127.0.0.1:11434";
export const DEFAULT_TIMEOUT_SEC = 120;
export const DEFAULT_OLLAMA_TIMEOUT_SEC = 60;
export const DEFAULT_COMMAND_TIMEOUT_SEC = 120;
export const DEFAULT_MAX_TOOL_CALLS = 8;
export const OLLAMA_THINK_LEVELS = ["low", "medium", "high"] as const;
export const OLLAMA_SKILL_SELECTION_MODES = ["deterministic", "llm"] as const;

/** Ollama accepts either a boolean thinking flag or one of its named effort levels. */
export type OllamaThinkLevel = typeof OLLAMA_THINK_LEVELS[number];
export type OllamaThinking = boolean | OllamaThinkLevel;
export type OllamaSkillSelectionMode = typeof OLLAMA_SKILL_SELECTION_MODES[number];

/** Fully normalized adapter configuration used by the server runtime. */
export interface OllamaAdapterConfig {
  /** Ollama model id, for example "gemma4:31b" or "deepseek-r1". */
  model: string;
  /** Root URL for the Ollama server. API paths are appended below this prefix. */
  baseUrl: string;
  /** Maximum number of seconds for a full Ollama run before the adapter aborts. */
  timeoutSec: number;
  /** Maximum number of seconds allowed for each Ollama HTTP request. */
  ollamaTimeoutSec: number;
  /** When enabled, logs prompts, request payloads, raw responses, and tool activity. */
  logging?: boolean;
  /** Allows the model to request trusted local command execution via run_command. */
  enableCommandExecution?: boolean;
  /** Default absolute working directory for model-requested commands. */
  commandCwd?: string;
  /** Maximum number of seconds allowed for each model-requested command. */
  commandTimeoutSec: number;
  /** Maximum number of command tool calls allowed during a single adapter run. */
  maxToolCalls: number;
  /** Optional Ollama thinking configuration mapped from Paperclip's thinking control. */
  think?: OllamaThinking;
  /** Optional system message sent before the rendered Paperclip prompt. */
  instructions?: string;
  /** Optional Paperclip template used to render the user prompt. */
  promptTemplate?: string;
  /** How selected Paperclip skills are expanded from metadata into full prompt instructions. */
  skillSelectionMode: OllamaSkillSelectionMode;
}

/** Session state persisted by Paperclip between adapter runs. */
export interface OllamaSessionParams {
  sessionId: string;
  model: string;
  createdAt: string;
  updatedAt: string;
  metadata: OllamaSessionMetadata;
}

/** Small set of provider metadata that is useful for debugging later runs. */
export interface OllamaSessionMetadata {
  endpoint?: string;
  lastCreatedAt?: string | null;
  doneReason?: string | null;
}

/** Internal request object passed from the Paperclip executor into the Ollama client. */
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
  runId?: string;
  onSpawn?: OllamaSpawnFn;
  commandExecution?: OllamaCommandExecutionOptions;
}

export type OllamaLogFn = (stream: "stdout" | "stderr", chunk: string) => Promise<void>;
export type OllamaSpawnFn = (meta: {
  pid: number;
  processGroupId: number | null;
  startedAt: string;
}) => Promise<void>;

/** Loaded skill metadata and instructions from a standard SKILL.md file. */
export interface OllamaSkill {
  key?: string;
  name: string;
  description: string;
  path: string;
  body: string | null;
  includeBody: boolean;
  required?: boolean;
}

/** Runtime options for the trusted run_command tool. */
export interface OllamaCommandExecutionOptions {
  enabled: boolean;
  cwd: string;
  timeoutSec: number;
  maxToolCalls: number;
}

/** Native Ollama tool-call shape returned in message.tool_calls. */
export interface OllamaToolCall {
  type?: "function";
  function?: {
    index?: number;
    name?: string;
    arguments?: unknown;
  };
}

/** Chat message format accepted by Ollama's /api/chat endpoint. */
export interface OllamaChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_name?: string;
  tool_calls?: OllamaToolCall[];
}

/** Request body sent to Ollama's /api/chat endpoint. */
export interface OllamaChatRequestBody {
  model: string;
  messages: OllamaChatMessage[];
  stream: boolean;
  think?: OllamaThinking;
  tools?: OllamaToolDefinition[];
}

/** Function-tool definition format used by Ollama-compatible models. */
export interface OllamaToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      required?: string[];
      properties: Record<string, unknown>;
    };
  };
}

/** Provider-neutral execution result returned to Paperclip by the adapter. */
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
  generation: {
    outputTokens: number;
    evalDurationMs: number | null;
    tokensPerSecond: number | null;
  };
  costUsd: number | null;
  session: OllamaSessionParams | null;
  raw: Record<string, unknown>;
}
