import type { ServerAdapterModule } from "@paperclipai/adapter-utils";
import { ADAPTER_TYPE } from "../types.js";
import { getConfigSchema } from "../ui/config-schema.js";
import { agentConfigurationDoc } from "./configuration-doc.js";
import { execute } from "./execute.js";
import { sessionCodec } from "./session.js";
import { testEnvironment } from "./test.js";

const models = [
  { id: "llama3.2", label: "Llama 3.2" },
  { id: "qwen2.5-coder", label: "Qwen 2.5 Coder" },
  { id: "deepseek-r1", label: "DeepSeek R1" }
];

export const ollamaAdapter: ServerAdapterModule = {
  type: ADAPTER_TYPE,
  execute,
  testEnvironment,
  sessionCodec,
  supportsLocalAgentJwt: true,
  models,
  async listModels() {
    return models;
  },
  getConfigSchema,
  agentConfigurationDoc
};

export function createServerAdapter(): ServerAdapterModule {
  return ollamaAdapter;
}

export { execute } from "./execute.js";
export { testEnvironment } from "./test.js";
export { sessionCodec } from "./session.js";
