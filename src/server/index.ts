import type { ServerAdapterModule } from "@paperclipai/adapter-utils";
import { ADAPTER_TYPE, DEFAULT_BASE_URL } from "../types.js";
import { agentConfigurationDoc } from "./configuration-doc.js";
import { execute } from "./execute.js";
import { listOllamaModels } from "./ollama.js";
import { sessionCodec } from "./session.js";
import { testEnvironment } from "./test.js";

export const ollamaAdapter: ServerAdapterModule = {
  type: ADAPTER_TYPE,
  execute,
  testEnvironment,
  sessionCodec,
  supportsLocalAgentJwt: true,
  models: [
    { id: "llama3.2", label: "Llama 3.2" },
    { id: "qwen2.5-coder", label: "Qwen 2.5 Coder" },
    { id: "deepseek-r1", label: "DeepSeek R1" }
  ],
  async listModels() {
    const discovered = await listOllamaModels(DEFAULT_BASE_URL);
    return discovered.map((model) => ({ id: model, label: model }));
  },
  agentConfigurationDoc
};

export { execute } from "./execute.js";
export { testEnvironment } from "./test.js";
export { sessionCodec } from "./session.js";
