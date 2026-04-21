import type { AdapterConfigSchema } from "@paperclipai/adapter-utils";
import { DEFAULT_BASE_URL, DEFAULT_TIMEOUT_SEC } from "../types.js";

export const ollamaConfigSchema: AdapterConfigSchema = {
  fields: [
    {
      key: "model",
      label: "Model",
      type: "combobox",
      required: true,
      hint: "Installed Ollama model name, for example llama3.2 or qwen2.5-coder.",
      options: [
        { label: "Llama 3.2", value: "llama3.2" },
        { label: "Qwen 2.5 Coder", value: "qwen2.5-coder" },
        { label: "DeepSeek R1", value: "deepseek-r1" }
      ]
    },
    {
      key: "baseUrl",
      label: "Base URL",
      type: "text",
      default: DEFAULT_BASE_URL,
      hint: "Ollama server root. The adapter calls /api/chat and /api/tags below this URL."
    },
    {
      key: "timeoutSec",
      label: "Timeout Seconds",
      type: "number",
      default: DEFAULT_TIMEOUT_SEC,
      hint: "Maximum seconds to wait for an Ollama request."
    },
    {
      key: "think",
      label: "Thinking",
      type: "select",
      hint: "Optional Ollama thinking control. GPT-OSS expects low, medium, or high.",
      options: [
        { label: "Default", value: "" },
        { label: "Enabled", value: "true" },
        { label: "Disabled", value: "false" },
        { label: "Low", value: "low" },
        { label: "Medium", value: "medium" },
        { label: "High", value: "high" }
      ]
    },
    {
      key: "instructions",
      label: "Instructions",
      type: "textarea",
      hint: "Optional system instructions sent as the first Ollama chat message."
    },
    {
      key: "promptTemplate",
      label: "Prompt Template",
      type: "textarea",
      hint: "Template for Paperclip wake context. Supports {{agent.name}}, {{run.id}}, {{contextJson}}, and dotted context paths."
    }
  ]
};

export function getConfigSchema(): AdapterConfigSchema {
  return ollamaConfigSchema;
}
