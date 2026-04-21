import type { AdapterSessionCodec } from "@paperclipai/adapter-utils";
import type { OllamaSessionParams } from "../types.js";

export const sessionCodec: AdapterSessionCodec = {
  deserialize(raw: unknown): Record<string, unknown> | null {
    const session = parseSession(raw);
    return session ? { ...session } : null;
  },

  serialize(params: Record<string, unknown> | null): Record<string, unknown> | null {
    const session = parseSession(params);
    return session ? { ...session } : null;
  },

  getDisplayId(params: Record<string, unknown> | null): string | null {
    const session = parseSession(params);
    return session?.sessionId ?? null;
  }
};

export function parseSession(raw: unknown): OllamaSessionParams | null {
  if (typeof raw !== "object" || raw === null) {
    return null;
  }

  const record = raw as Record<string, unknown>;
  if (
    typeof record.sessionId !== "string" ||
    typeof record.model !== "string" ||
    typeof record.createdAt !== "string" ||
    typeof record.updatedAt !== "string"
  ) {
    return null;
  }

  return {
    sessionId: record.sessionId,
    model: record.model,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    metadata: readMetadata(record.metadata)
  };
}

export function createPlaceholderSession(model: string): OllamaSessionParams {
  const now = new Date().toISOString();
  return {
    sessionId: `ollama:${model}:${now}`,
    model,
    createdAt: now,
    updatedAt: now,
    metadata: {}
  };
}

function readMetadata(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}
