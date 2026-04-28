import { afterEach, describe, expect, it, vi } from "vitest";
import {
  OLLAMA_CHAT_PATH,
  buildOllamaChatRequestBody,
  buildOllamaApiUrl,
  invokeOllama,
  listOllamaModels,
  parseOllamaTagsResponse,
  readOllamaResponsePayload
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
      stream: true,
      think: "low"
    });
  });

  it("can disable streaming in the chat request body", () => {
    const body = buildOllamaChatRequestBody({
      baseUrl: "http://127.0.0.1:11434",
      model: "llama3.2",
      prompt: "Continue your work.",
      timeoutMs: 120_000,
      session: null,
      streaming: false
    });

    expect(body.stream).toBe(false);
  });

  it("describes run_command with direct args and shell support", () => {
    const body = buildOllamaChatRequestBody({
      baseUrl: "http://127.0.0.1:11434",
      model: "llama3.2",
      prompt: "Run a command.",
      timeoutMs: 120_000,
      session: null,
      commandExecution: {
        enabled: true,
        cwd: process.cwd(),
        timeoutSec: 120,
        maxToolCalls: 8
      }
    });

    const toolJson = JSON.stringify(body.tools?.[0]);
    expect(toolJson).toContain("Run a trusted local command");
    expect(toolJson).toContain("use sh -lc for shell syntax");
    expect(toolJson).toContain("Executable name or path");
    expect(toolJson).toContain("Arguments as separate strings");
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
      eval_count: 8,
      eval_duration: 2_000_000_000
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
        dispatcher: expect.any(Object),
        body: JSON.stringify({
          model: "llama3.2",
          messages: [{ role: "user", content: "Continue." }],
          stream: true
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
      generation: {
        outputTokens: 8,
        evalDurationMs: 2000,
        tokensPerSecond: 4
      },
      costUsd: 0
    });
    expect(result.raw.generation).toEqual({
      outputTokens: 8,
      evalDurationMs: 2000,
      tokensPerSecond: 4
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

  it("rotates sessionId and session model when the configured model changes", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      model: "gemma4:31b",
      created_at: "2026-04-21T10:10:00Z",
      message: {
        role: "assistant",
        content: "Switched models."
      },
      done: true,
      prompt_eval_count: 4,
      eval_count: 5
    })));
    vi.stubGlobal("fetch", fetchMock);

    const result = await invokeOllama({
      baseUrl: "http://ollama.local:11434",
      model: "gemma4:31b",
      prompt: "Continue.",
      timeoutMs: 120_000,
      session: {
        sessionId: "ollama:llama3.2:2026-04-21T10:00:00.000Z",
        model: "llama3.2",
        createdAt: "2026-04-21T10:00:00.000Z",
        updatedAt: "2026-04-21T10:05:00.000Z",
        metadata: {
          endpoint: "http://ollama.local:11434/api/chat",
          lastCreatedAt: "2026-04-21T10:05:00Z",
          doneReason: "stop"
        }
      }
    });

    expect(result.success).toBe(true);
    expect(result.session?.model).toBe("gemma4:31b");
    expect(result.session?.sessionId).toContain("ollama:gemma4:31b:");
    expect(result.session?.sessionId).not.toBe("ollama:llama3.2:2026-04-21T10:00:00.000Z");
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
      eval_count: 3,
      eval_duration: 1_500_000_000
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
    expect(joined).toContain("[ollama] generation_speed 3 output tokens in 1.50s = 2.00 tokens/s");
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
        eval_count: 4,
        eval_duration: 1_000_000_000
      })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        model: "llama3.2",
        message: {
          role: "assistant",
          content: "The command printed tool ok."
        },
        done: true,
        prompt_eval_count: 5,
        eval_count: 6,
        eval_duration: 2_000_000_000
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
    expect(result.generation).toEqual({
      outputTokens: 10,
      evalDurationMs: 3000,
      tokensPerSecond: 3.33
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[1]?.body).toContain("\"tools\"");
    expect(fetchMock.mock.calls[1]?.[1]?.body).toContain("\"role\":\"tool\"");
    expect(fetchMock.mock.calls[1]?.[1]?.body).toContain("tool ok");
    expect(logs.map((log) => log.chunk).join("\n")).toContain("[ollama:tool] run_command");
  });
});

describe("readOllamaResponsePayload", () => {
  it("aggregates streamed Ollama chat chunks", async () => {
    const logs: string[] = [];
    await expect(readOllamaResponsePayload(new Response([
      JSON.stringify({
        model: "llama3.2",
        message: { role: "assistant", content: "Hello " },
        done: false
      }),
      JSON.stringify({
        model: "llama3.2",
        message: { role: "assistant", content: "world." },
        done: true,
        prompt_eval_count: 2,
        eval_count: 3
      })
    ].join("\n")), true, async (_stream, chunk) => {
      logs.push(chunk);
    })).resolves.toMatchObject({
      model: "llama3.2",
      message: {
        content: "Hello world."
      },
      done: true,
      prompt_eval_count: 2,
      eval_count: 3
    });
    expect(logs).toEqual(["Hello ", "world."]);
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
