import { ollamaAdapter } from "./server/index.js";
import { ADAPTER_TYPE } from "./types.js";
import type { ServerAdapterModule } from "@paperclipai/adapter-utils";

export const adapterType = ADAPTER_TYPE;

export const models = [
  { id: "llama3.2", label: "Llama 3.2" },
  { id: "qwen2.5-coder", label: "Qwen 2.5 Coder" },
  { id: "deepseek-r1", label: "DeepSeek R1" }
];

export const manifest = {
  id: "paperclip-ollama-adapter",
  name: "Local Ollama",
  description: "Runs Paperclip agents against a local Ollama server.",
  adapters: [
    {
      type: ADAPTER_TYPE,
      label: "Local Ollama",
      models
    }
  ]
};

export { ollamaAdapter };

export function createServerAdapter(): ServerAdapterModule {
  return ollamaAdapter;
}

export default ollamaAdapter;
