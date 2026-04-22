import { afterEach, describe, expect, it, vi } from "vitest";
import {
  OLLAMA_CHAT_PATH,
  buildOllamaChatRequestBody,
  buildOllamaApiUrl,
  invokeOllama,
  listOllamaModels,
  parseOllamaTagsResponse
} from "./ollama.js";

describe("buildOllamaApiUrl", () => {
  it("uses baseUrl as the prefix for Ollama API paths", () => {
    expect(buildOllamaApiUrl("http://127.0.0.1:11434/", "/api/tags"))
      .toBe("http://127.0.0.1:11434/api/tags");
  });

  it("defines /api/chat as the Ollama invocation endpoint", () => {
    expect(OLLAMA_CHAT_PATH).toBe("/api/chat");
  });
});

describe("buildOllamaChatRequestBody", () => {
  it("builds a chat request body with optional system instructions", () => {
    const body = buildOllamaChatRequestBody({
      baseUrl: "http://127.0.0.1:11434",
      model: "llama3.2",
      prompt: "Continue your work.",
      instructions: "You are a Paperclip agent.",
      think: "low",
      timeoutMs: 120_000,
      session: null
    });

    expect(body).toEqual({
      model: "llama3.2",
      messages: [
        { role: "system", content: "You are a Paperclip agent." },
        { role: "user", content: "Continue your work." }
      ],
      stream: false,
      think: "low"
    });
  });
});

describe("invokeOllama", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts to /api/chat and maps a successful response", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      model: "llama3.2",
      created_at: "2026-04-21T10:00:00Z",
      message: {
        role: "assistant",
        content: "Work completed."
      },
      done: true,
      prompt_eval_count: 12,
      eval_count: 8
    })));
    vi.stubGlobal("fetch", fetchMock);

    const result = await invokeOllama({
      baseUrl: "http://ollama.local:11434/",
      model: "llama3.2",
      prompt: "Continue.",
      timeoutMs: 120_000,
      session: null
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://ollama.local:11434/api/chat",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "llama3.2",
          messages: [{ role: "user", content: "Continue." }],
          stream: false
        })
      })
    );
    expect(result).toMatchObject({
      success: true,
      timedOut: false,
      model: "llama3.2",
      responseText: "Work completed.",
      summary: "Work completed.",
      usage: {
        inputTokens: 12,
        outputTokens: 8,
        totalTokens: 20
      },
      costUsd: 0
    });
    expect(result.session?.sessionId).toContain("ollama:llama3.2:");
    expect(result.session?.metadata).toEqual({
      endpoint: "http://ollama.local:11434/api/chat",
      lastCreatedAt: "2026-04-21T10:00:00Z",
      doneReason: null
    });
  });

  it("returns a structured failure for non-OK responses", async () => {
    const fetchMock = vi.fn(async () => new Response(
      JSON.stringify({ error: "model not found" }),
      { status: 404 }
    ));
    vi.stubGlobal("fetch", fetchMock);

    const result = await invokeOllama({
      baseUrl: "http://ollama.local:11434",
      model: "missing-model",
      prompt: "Continue.",
      timeoutMs: 120_000,
      session: null
    });

    expect(result).toMatchObject({
      success: false,
      timedOut: false,
      error: "model not found",
      errorCode: "ollama_http_error"
    });
  });

  it("logs chat request and reply details when logging is enabled", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      model: "llama3.2",
      message: {
        role: "assistant",
        content: "Logged reply."
      },
      done: true,
      prompt_eval_count: 2,
      eval_count: 3
    })));
    const logs: Array<{ stream: "stdout" | "stderr"; chunk: string }> = [];
    vi.stubGlobal("fetch", fetchMock);

    await invokeOllama({
      baseUrl: "http://ollama.local:11434",
      model: "llama3.2",
      prompt: "Log this prompt.",
      timeoutMs: 120_000,
      session: null,
      logging: true,
      onLog: async (stream, chunk) => {
        logs.push({ stream, chunk });
      }
    });

    const joined = logs.map((log) => log.chunk).join("\n");
    expect(joined).toContain("Sending Ollama chat request");
    expect(joined).toContain("Log this prompt.");
    expect(joined).toContain("Received Ollama chat response");
    expect(joined).toContain("Logged reply.");
    expect(joined).toContain("Parsed Ollama chat result");
  });

  it("executes run_command tool calls and sends results back to Ollama", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        model: "llama3.2",
        message: {
          role: "assistant",
          content: "",
          tool_calls: [
            {
              type: "function",
              function: {
                name: "run_command",
                arguments: {
                  command: process.execPath,
                  args: ["-e", "console.log('tool ok')"]
                }
              }
            }
          ]
        },
        done: true,
        prompt_eval_count: 3,
        eval_count: 4
      })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        model: "llama3.2",
        message: {
          role: "assistant",
          content: "The command printed tool ok."
        },
        done: true,
        prompt_eval_count: 5,
        eval_count: 6
      })));
    vi.stubGlobal("fetch", fetchMock);

    const logs: Array<{ stream: "stdout" | "stderr"; chunk: string }> = [];
    const result = await invokeOllama({
      baseUrl: "http://ollama.local:11434",
      model: "llama3.2",
      prompt: "Run a command.",
      timeoutMs: 120_000,
      session: null,
      runId: "run-tool-test",
      onLog: async (stream, chunk) => {
        logs.push({ stream, chunk });
      },
      commandExecution: {
        enabled: true,
        cwd: process.cwd(),
        timeoutSec: 30,
        maxToolCalls: 2
      }
    });

    expect(result.success).toBe(true);
    expect(result.responseText).toBe("The command printed tool ok.");
    expect(result.usage).toEqual({
      inputTokens: 8,
      outputTokens: 10,
      totalTokens: 18
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[1]?.body).toContain("\"tools\"");
    expect(fetchMock.mock.calls[1]?.[1]?.body).toContain("\"role\":\"tool\"");
    expect(fetchMock.mock.calls[1]?.[1]?.body).toContain("tool ok");
    expect(logs.map((log) => log.chunk).join("\n")).toContain("[ollama:tool] run_command");
  });
});

describe("parseOllamaTagsResponse", () => {
  it("returns model names from Ollama /api/tags payloads", () => {
    const models = parseOllamaTagsResponse({
      models: [
        { name: "llama3.2:latest" },
        { model: "qwen2.5-coder:7b" },
        { digest: "missing-name" }
      ]
    });

    expect(models).toEqual(["llama3.2:latest", "qwen2.5-coder:7b"]);
  });
});

describe("listOllamaModels", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches GET /api/tags from the configured baseUrl", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      models: [{ name: "llama3.2:latest" }]
    })));
    vi.stubGlobal("fetch", fetchMock);

    await expect(listOllamaModels("http://ollama.local:11434/"))
      .resolves.toEqual(["llama3.2:latest"]);

    expect(fetchMock).toHaveBeenCalledWith(
      "http://ollama.local:11434/api/tags",
      { method: "GET" }
    );
  });
});
