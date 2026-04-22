import { describe, expect, it, vi } from "vitest";
import { ollamaAdapter } from "./index.js";

describe("ollamaAdapter", () => {
  it("does not query Ollama from listModels because Paperclip does not pass adapter config there", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(ollamaAdapter.listModels?.()).resolves.toEqual([
      { id: "llama3.2", label: "Llama 3.2" },
      { id: "qwen2.5-coder", label: "Qwen 2.5 Coder" },
      { id: "deepseek-r1", label: "DeepSeek R1" }
    ]);
    expect(fetchMock).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });
});
