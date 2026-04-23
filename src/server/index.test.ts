import { afterEach, describe, expect, it, vi } from "vitest";
import { clearCachedModels } from "./model-cache.js";
import { ollamaAdapter } from "./index.js";
import { testEnvironment } from "./test.js";

describe("ollamaAdapter", () => {
  afterEach(() => {
    clearCachedModels();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("discovers model options from Ollama /api/tags using the default discovery URL", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        models: [
          { name: "gemma4:31b" },
          { model: "deepseek-r1:latest" }
        ]
      })
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(ollamaAdapter.listModels?.()).resolves.toEqual([
      { id: "gemma4:31b", label: "gemma4:31b" },
      { id: "deepseek-r1:latest", label: "deepseek-r1:latest" }
    ]);
    expect(fetchMock).toHaveBeenCalledWith("http://127.0.0.1:11434/api/tags", { method: "GET" });
  });

  it("uses OLLAMA_BASE_URL for model discovery when configured", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ models: [{ name: "qwen3:latest" }] })
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("OLLAMA_BASE_URL", "http://ollama:11434");

    await expect(ollamaAdapter.listModels?.()).resolves.toEqual([
      { id: "qwen3:latest", label: "qwen3:latest" }
    ]);
    expect(fetchMock).toHaveBeenCalledWith("http://ollama:11434/api/tags", { method: "GET" });
  });

  it("uses the model cache populated by Test environment", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ models: [{ name: "gemma4:31b" }] })
    });
    vi.stubGlobal("fetch", fetchMock);

    await testEnvironment({
      companyId: "company_1",
      adapterType: "ollama_local",
      config: {
        model: "gemma4:31b",
        baseUrl: "http://ollama:11434"
      }
    });

    fetchMock.mockClear();
    await expect(ollamaAdapter.listModels?.()).resolves.toEqual([
      { id: "gemma4:31b", label: "gemma4:31b" }
    ]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("falls back to known models when live discovery is unavailable", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("connect ECONNREFUSED"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(ollamaAdapter.listModels?.()).resolves.toEqual([
      { id: "llama3.2", label: "Llama 3.2" },
      { id: "qwen2.5-coder", label: "Qwen 2.5 Coder" },
      { id: "deepseek-r1", label: "DeepSeek R1" }
    ]);
  });
});
