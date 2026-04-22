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

/**
 * Static server adapter definition consumed by Paperclip.
 *
 * `listModels` remains static because Paperclip currently calls it without an
 * adapter config object. Configured `/api/tags` discovery is handled by the
 * environment test path where the selected `baseUrl` is available.
 */
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

/** Required package-level export used by Paperclip when installing adapters. */
export function createServerAdapter(): ServerAdapterModule {
  return ollamaAdapter;
}

export { execute } from "./execute.js";
export { testEnvironment } from "./test.js";
export { sessionCodec } from "./session.js";
