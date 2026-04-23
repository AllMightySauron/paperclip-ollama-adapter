import { ollamaAdapter } from "./server/index.js";
import { fallbackModels } from "./models.js";
import { ADAPTER_TYPE } from "./types.js";
import type { ServerAdapterModule } from "@paperclipai/adapter-utils";

export const adapterType = ADAPTER_TYPE;

export const models = fallbackModels;

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
