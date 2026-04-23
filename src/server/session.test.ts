import { describe, expect, it } from "vitest";
import { initializeSession, parseSession, sessionCodec } from "./session.js";

describe("session persistence", () => {
  it("keeps only lightweight adapter continuity metadata", () => {
    const session = parseSession({
      sessionId: "ollama:llama3.2:2026-04-21T10:00:00.000Z",
      model: "llama3.2",
      createdAt: "2026-04-21T10:00:00.000Z",
      updatedAt: "2026-04-21T10:05:00.000Z",
      metadata: {
        endpoint: "http://127.0.0.1:11434/api/chat",
        lastCreatedAt: "2026-04-21T10:05:00Z",
        doneReason: "stop",
        inputTokens: 100,
        outputTokens: 50,
        responseText: "do not persist model output"
      }
    });

    expect(session?.metadata).toEqual({
      endpoint: "http://127.0.0.1:11434/api/chat",
      lastCreatedAt: "2026-04-21T10:05:00Z",
      doneReason: "stop"
    });
  });

  it("serializes through the same metadata allowlist", () => {
    const serialized = sessionCodec.serialize({
      sessionId: "ollama:llama3.2:2026-04-21T10:00:00.000Z",
      model: "llama3.2",
      createdAt: "2026-04-21T10:00:00.000Z",
      updatedAt: "2026-04-21T10:05:00.000Z",
      metadata: {
        endpoint: "http://127.0.0.1:11434/api/chat",
        lastCreatedAt: null,
        doneReason: null,
        totalDuration: 12345
      }
    });

    expect(serialized?.metadata).toEqual({
      endpoint: "http://127.0.0.1:11434/api/chat",
      lastCreatedAt: null,
      doneReason: null
    });
  });

  it("rotates the adapter session when the model changes", () => {
    const session = initializeSession("gemma4:31b", {
      sessionId: "ollama:llama3.2:2026-04-21T10:00:00.000Z",
      model: "llama3.2",
      createdAt: "2026-04-21T10:00:00.000Z",
      updatedAt: "2026-04-21T10:05:00.000Z",
      metadata: {
        endpoint: "http://127.0.0.1:11434/api/chat"
      }
    });

    expect(session.model).toBe("gemma4:31b");
    expect(session.sessionId).toContain("ollama:gemma4:31b:");
    expect(session.metadata).toEqual({});
  });
});
