import {
  DEFAULT_TIMEOUT_SEC,
  OLLAMA_THINK_LEVELS,
  type OllamaAdapterConfig,
  type OllamaThinking
} from "../types.js";
import { readDefaultBaseUrl } from "../base-url.js";

export type OllamaConfigFormValues = Partial<{
  model: string;
  baseUrl: string;
  timeoutSec: string | number;
  logging: boolean | "true" | "false";
  enableCommandExecution: boolean | "true" | "false";
  commandCwd: string;
  commandTimeoutSec: string | number;
  maxToolCalls: string | number;
  think: "" | "true" | "false" | OllamaThinking;
  instructions: string;
  promptTemplate: string;
}>;

export function buildConfigFromFormValues(
  values: OllamaConfigFormValues
): Partial<OllamaAdapterConfig> {
  // TODO: Replace with Paperclip UI field definitions when external adapter UI
  // extension points are finalized.
  const config: Partial<OllamaAdapterConfig> = {
    model: values.model?.trim() ?? "",
    baseUrl: values.baseUrl?.trim() || readDefaultBaseUrl(),
    timeoutSec: Number(values.timeoutSec ?? DEFAULT_TIMEOUT_SEC)
  };

  if (values.logging !== undefined) {
    config.logging = normalizeBooleanFormValue(values.logging);
  }
  if (values.enableCommandExecution !== undefined) {
    config.enableCommandExecution = normalizeBooleanFormValue(values.enableCommandExecution);
  }
  if (values.commandCwd) {
    config.commandCwd = values.commandCwd;
  }
  if (values.commandTimeoutSec !== undefined) {
    config.commandTimeoutSec = Number(values.commandTimeoutSec);
  }
  if (values.maxToolCalls !== undefined) {
    config.maxToolCalls = Number(values.maxToolCalls);
  }
  if (values.think !== undefined && values.think !== "") {
    config.think = normalizeThinkFormValue(values.think);
  }
  if (values.instructions) {
    config.instructions = values.instructions;
  }
  if (values.promptTemplate) {
    config.promptTemplate = values.promptTemplate;
  }

  return config;
}

function normalizeThinkFormValue(value: "true" | "false" | OllamaThinking): OllamaThinking {
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  if (typeof value === "string" && OLLAMA_THINK_LEVELS.includes(value)) {
    return value;
  }
  return value;
}

function normalizeBooleanFormValue(value: boolean | "true" | "false"): boolean {
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  return value;
}
