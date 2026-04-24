import type { ServerAdapterModule } from "@paperclipai/adapter-utils";
import { readDefaultBaseUrl } from "../base-url.js";
import { fallbackModels, toAdapterModels } from "../models.js";
import { ADAPTER_TYPE } from "../types.js";
import { getConfigSchema } from "../ui/config-schema.js";
import { agentConfigurationDoc } from "./configuration-doc.js";
import { execute } from "./execute.js";
import { cacheDiscoveredModels, getCachedModels } from "./model-cache.js";
import { listOllamaModels } from "./ollama.js";
import { sessionCodec } from "./session.js";
import { listOllamaSkills, syncOllamaSkills } from "./skills.js";
import { testEnvironment } from "./test.js";

/**
 * Static server adapter definition consumed by Paperclip.
 *
 * Paperclip's current `listModels` hook does not receive adapter config, so it
 * cannot read the UI's `baseUrl` field directly. The environment test can use
 * that configured URL, so it stores successful `/api/tags` results in a
 * process-local cache. The dropdown uses that cache first, then tries live
 * discovery against `OLLAMA_BASE_URL` or the local default, then falls back to a
 * safe static list if discovery is unavailable.
 */
export const ollamaAdapter: ServerAdapterModule = {
  type: ADAPTER_TYPE,
  execute,
  testEnvironment,
  listSkills: listOllamaSkills,
  syncSkills: syncOllamaSkills,
  sessionCodec,
  supportsLocalAgentJwt: true,
  models: fallbackModels,
  async listModels() {
    const cached = getCachedModels();
    if (cached) {
      return cached.models;
    }

    try {
      const baseUrl = readModelDiscoveryBaseUrl();
      const modelIds = await listOllamaModels(baseUrl);
      cacheDiscoveredModels(baseUrl, modelIds);
      return modelIds.length > 0 ? toAdapterModels(modelIds) : fallbackModels;
    } catch {
      return fallbackModels;
    }
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
export {
  listOllamaSkills,
  syncOllamaSkills,
  resolveOllamaDesiredSkillNames
} from "./skills.js";

function readModelDiscoveryBaseUrl(): string {
  return readDefaultBaseUrl();
}
