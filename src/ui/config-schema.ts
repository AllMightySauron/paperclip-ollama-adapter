import type { AdapterConfigSchema } from "@paperclipai/adapter-utils";
import { readDefaultBaseUrl } from "../base-url.js";

/**
 * Custom adapter UI fields.
 *
 * Paperclip owns built-in controls such as model and timeout. This adapter
 * intentionally defines its own thinking selector so users can choose `Off`,
 * which the current Paperclip built-in control does not expose.
 */
export const ollamaConfigSchema: AdapterConfigSchema = {
  fields: [
    {
      key: "baseUrl",
      label: "Base URL",
      type: "text",
      default: readDefaultBaseUrl(),
      hint: "Ollama server root. Defaults to OLLAMA_BASE_URL when set, otherwise http://127.0.0.1:11434. The adapter calls /api/chat and /api/tags below this URL."
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
      key: "think",
      label: "Thinking",
      type: "select",
      default: "",
      hint: "Adapter-specific thinking control. Use Off to send think=false to Ollama. This value overrides Paperclip's built-in Thinking Effort field when set.",
      options: [
        { label: "Auto", value: "" },
        { label: "Off", value: "false" },
        { label: "Low", value: "low" },
        { label: "Medium", value: "medium" },
        { label: "High", value: "high" }
      ]
    },
    {
      key: "enableCommandExecution",
      label: "Command Execution",
      type: "select",
      default: "false",
      hint: "Allow this trusted local adapter to run direct commands requested by the model. This can modify files and execute scripts.",
      options: [
        { label: "Disabled", value: "false" },
        { label: "Enabled", value: "true" }
      ]
    },
    {
      key: "commandCwd",
      label: "Command Working Directory",
      type: "text",
      hint: "Absolute directory for model-requested commands. Defaults to Paperclip's built-in working directory when provided, otherwise the adapter process directory."
    },
    {
      key: "commandTimeoutSec",
      label: "Command Timeout Seconds",
      type: "number",
      default: 120,
      hint: "Maximum seconds each model-requested command may run."
    },
    {
      key: "maxToolCalls",
      label: "Max Tool Calls",
      type: "number",
      default: 8,
      hint: "Maximum number of command tool calls allowed during one agent run."
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

/** Exposes the UI schema through the server adapter module. */
export function getConfigSchema(): AdapterConfigSchema {
  return {
    fields: ollamaConfigSchema.fields.map((field) => {
      if (field.key !== "baseUrl") {
        return field;
      }

      return {
        ...field,
        default: readDefaultBaseUrl()
      };
    })
  };
}
