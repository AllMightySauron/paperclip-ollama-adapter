import {
  DEFAULT_BASE_URL,
  DEFAULT_TIMEOUT_SEC,
  type OllamaAdapterConfig
} from "../types.js";

export type OllamaConfigFormValues = Partial<{
  model: string;
  baseUrl: string;
  timeoutSec: string | number;
  think: "high" | "low" | "false" | false;
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

  if (values.think !== undefined) {
    config.think = values.think === "false" ? false : values.think;
  }
  if (values.instructions) {
    config.instructions = values.instructions;
  }
  if (values.promptTemplate) {
    config.promptTemplate = values.promptTemplate;
  }

  return config;
}
