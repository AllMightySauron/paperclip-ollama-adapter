import {
  DEFAULT_BASE_URL,
  DEFAULT_TIMEOUT_SEC,
  OLLAMA_THINK_LEVELS,
  type OllamaAdapterConfig,
  type OllamaThinking
} from "../types.js";

export interface ConfigParseResult {
  config: OllamaAdapterConfig | null;
  errors: string[];
}

export function parseConfig(raw: Record<string, unknown>): ConfigParseResult {
  const errors: string[] = [];
  const schemaValues = readRecord(raw.adapterSchemaValues);
  const model = readString(readConfigValue(raw, schemaValues, "model"))?.trim();
  const baseUrl = readString(readConfigValue(raw, schemaValues, "baseUrl"))?.trim() || DEFAULT_BASE_URL;
  const timeoutSec = readNumber(readConfigValue(raw, schemaValues, "timeoutSec"), DEFAULT_TIMEOUT_SEC);
  const logging = readBoolean(readConfigValue(raw, schemaValues, "logging"));
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
      ...(logging !== undefined ? { logging } : {}),
      ...(think !== undefined ? { think } : {}),
      ...(instructions ? { instructions } : {}),
      ...(promptTemplate ? { promptTemplate } : {})
    },
    errors
  };
}

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
