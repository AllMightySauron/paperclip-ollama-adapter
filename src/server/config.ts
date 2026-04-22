import {
  DEFAULT_BASE_URL,
  DEFAULT_COMMAND_TIMEOUT_SEC,
  DEFAULT_MAX_TOOL_CALLS,
  DEFAULT_TIMEOUT_SEC,
  OLLAMA_THINK_LEVELS,
  type OllamaAdapterConfig,
  type OllamaThinking
} from "../types.js";

export interface ConfigParseResult {
  config: OllamaAdapterConfig | null;
  errors: string[];
}

/**
 * Normalizes Paperclip configuration into the adapter's runtime shape.
 *
 * Paperclip can provide values either as top-level built-ins (`model`,
 * `timeoutSec`, `thinkingEffort`) or under `adapterSchemaValues` for custom UI
 * fields. This parser intentionally accepts both locations so the adapter stays
 * compatible across Paperclip UI/runtime versions.
 */
export function parseConfig(raw: Record<string, unknown>): ConfigParseResult {
  const errors: string[] = [];
  const schemaValues = readRecord(raw.adapterSchemaValues);
  const model = readString(readConfigValue(raw, schemaValues, "model"))?.trim();
  const baseUrl = readString(readConfigValue(raw, schemaValues, "baseUrl"))?.trim() || DEFAULT_BASE_URL;
  const timeoutSec = readNumber(readConfigValue(raw, schemaValues, "timeoutSec"), DEFAULT_TIMEOUT_SEC);
  const logging = readBoolean(readConfigValue(raw, schemaValues, "logging"));
  const enableCommandExecution = readBoolean(readConfigValue(raw, schemaValues, "enableCommandExecution")) ?? false;
  const commandCwd = readString(readConfigValue(raw, schemaValues, "commandCwd"))
    ?? readString(readConfigValue(raw, schemaValues, "cwd"));
  const commandTimeoutSec = readNumber(
    readConfigValue(raw, schemaValues, "commandTimeoutSec"),
    DEFAULT_COMMAND_TIMEOUT_SEC
  );
  const maxToolCalls = readNumber(
    readConfigValue(raw, schemaValues, "maxToolCalls"),
    DEFAULT_MAX_TOOL_CALLS
  );
  const thinkValue = readConfigValue(raw, schemaValues, "think")
    ?? readConfigValue(raw, schemaValues, "thinkingEffort");
  const think = parseThink(thinkValue);
  const instructions = readString(readConfigValue(raw, schemaValues, "instructions"));
  const promptTemplate = readString(readConfigValue(raw, schemaValues, "promptTemplate"));

  if (!model) {
    errors.push("Missing required field: model");
  }

  if (!isValidHttpUrl(baseUrl)) {
    errors.push("baseUrl must be a valid HTTP or HTTPS URL");
  }

  if (!Number.isFinite(timeoutSec) || timeoutSec <= 0) {
    errors.push("timeoutSec must be greater than 0");
  }

  if (!Number.isFinite(commandTimeoutSec) || commandTimeoutSec <= 0) {
    errors.push("commandTimeoutSec must be greater than 0");
  }

  if (!Number.isInteger(maxToolCalls) || maxToolCalls <= 0) {
    errors.push("maxToolCalls must be a positive integer");
  }

  if (enableCommandExecution && commandCwd !== undefined && commandCwd.trim() === "") {
    errors.push("commandCwd cannot be empty when command execution is enabled");
  }

  if (thinkValue !== undefined && think === undefined) {
    errors.push('think must be true, false, "low", "medium", "high", or omitted');
  }

  if (errors.length > 0 || !model) {
    return { config: null, errors };
  }

  return {
    config: {
      model,
      baseUrl: stripTrailingSlash(baseUrl),
      timeoutSec,
      enableCommandExecution,
      commandTimeoutSec,
      maxToolCalls,
      ...(commandCwd ? { commandCwd } : {}),
      ...(logging !== undefined ? { logging } : {}),
      ...(think !== undefined ? { think } : {}),
      ...(instructions ? { instructions } : {}),
      ...(promptTemplate ? { promptTemplate } : {})
    },
    errors
  };
}

/** Reads a config key from built-in values first, then custom schema values. */
function readConfigValue(
  raw: Record<string, unknown>,
  schemaValues: Record<string, unknown>,
  key: string
): unknown {
  return raw[key] ?? schemaValues[key];
}

function readRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? value as Record<string, unknown>
    : {};
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function readNumber(value: unknown, fallback: number): number {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    return Number(value);
  }
  return fallback;
}

function readBoolean(value: unknown): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "true") {
    return true;
  }
  if (normalized === "false") {
    return false;
  }

  return undefined;
}

function parseThink(value: unknown): OllamaThinking | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "true") {
    return true;
  }
  if (normalized === "false") {
    return false;
  }
  if (isThinkLevel(normalized)) {
    return normalized;
  }

  return undefined;
}

function isThinkLevel(value: string): value is typeof OLLAMA_THINK_LEVELS[number] {
  return OLLAMA_THINK_LEVELS.includes(value as typeof OLLAMA_THINK_LEVELS[number]);
}

function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}
