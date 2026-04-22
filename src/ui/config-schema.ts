import type { AdapterConfigSchema } from "@paperclipai/adapter-utils";
import { DEFAULT_BASE_URL } from "../types.js";

export const ollamaConfigSchema: AdapterConfigSchema = {
  fields: [
    {
      key: "baseUrl",
      label: "Base URL",
      type: "text",
      default: DEFAULT_BASE_URL,
      hint: "Ollama server root. The adapter calls /api/chat and /api/tags below this URL."
    },
    {
      key: "logging",
      label: "Detailed Logging",
      type: "select",
      default: "false",
      hint: "Log prompt rendering, Ollama /api/chat request bodies, raw replies, parsed results, and errors. May include sensitive prompt/context data.",
      options: [
        { label: "Disabled", value: "false" },
        { label: "Enabled", value: "true" }
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
