import {
  DEFAULT_BASE_URL,
  DEFAULT_TIMEOUT_SEC,
  OLLAMA_THINK_LEVELS,
  type OllamaAdapterConfig,
  type OllamaThinking
} from "../types.js";

export type OllamaConfigFormValues = Partial<{
  model: string;
  baseUrl: string;
  timeoutSec: string | number;
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
    baseUrl: values.baseUrl?.trim() || DEFAULT_BASE_URL,
    timeoutSec: Number(values.timeoutSec ?? DEFAULT_TIMEOUT_SEC)
  };

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
