import { DEFAULT_BASE_URL } from "./types.js";

/** Environment variable used to point the adapter at a non-default Ollama host. */
export const OLLAMA_BASE_URL_ENV = "OLLAMA_BASE_URL";

/** Returns the configured process default for Ollama, falling back to localhost. */
export function readDefaultBaseUrl(): string {
  return process.env[OLLAMA_BASE_URL_ENV]?.trim() || DEFAULT_BASE_URL;
}
