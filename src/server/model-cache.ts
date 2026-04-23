import type { AdapterModel } from "@paperclipai/adapter-utils";
import { toAdapterModels } from "../models.js";

export interface CachedOllamaModels {
  baseUrl: string;
  models: AdapterModel[];
  discoveredAt: string;
}

let cachedModels: CachedOllamaModels | null = null;

/** Stores the most recent successful `/api/tags` result for this adapter process. */
export function cacheDiscoveredModels(baseUrl: string, modelIds: string[]): CachedOllamaModels | null {
  if (modelIds.length === 0) {
    return null;
  }

  cachedModels = {
    baseUrl,
    models: toAdapterModels(modelIds),
    discoveredAt: new Date().toISOString()
  };

  return cachedModels;
}

/** Returns the process-local model discovery cache populated by Test environment. */
export function getCachedModels(): CachedOllamaModels | null {
  return cachedModels;
}

/** Test helper for isolating process-local cache state. */
export function clearCachedModels(): void {
  cachedModels = null;
}
