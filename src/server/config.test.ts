import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_BASE_URL, DEFAULT_OLLAMA_TIMEOUT_SEC, DEFAULT_TIMEOUT_SEC } from "../types.js";
import { parseConfig } from "./config.js";

describe("parseConfig", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("requires a model", () => {
    const result = parseConfig({});

    expect(result.config).toBeNull();
    expect(result.errors).toContain("Missing required field: model");
  });

  it("applies default baseUrl and timeoutSec", () => {
    const result = parseConfig({ model: "llama3.2" });

    expect(result.errors).toEqual([]);
    expect(result.config).toMatchObject({
      model: "llama3.2",
      baseUrl: DEFAULT_BASE_URL,
      timeoutSec: DEFAULT_TIMEOUT_SEC,
      ollamaTimeoutSec: DEFAULT_OLLAMA_TIMEOUT_SEC,
      streaming: true
    });
  });

  it("defaults baseUrl from OLLAMA_BASE_URL when present", () => {
    vi.stubEnv("OLLAMA_BASE_URL", "http://ollama:11434/");

    const result = parseConfig({ model: "llama3.2" });

    expect(result.errors).toEqual([]);
    expect(result.config?.baseUrl).toBe("http://ollama:11434");
  });

  it("prefers explicit baseUrl over OLLAMA_BASE_URL", () => {
    vi.stubEnv("OLLAMA_BASE_URL", "http://ollama:11434");

    const result = parseConfig({
      model: "llama3.2",
      baseUrl: "http://custom-ollama:11434"
    });

    expect(result.errors).toEqual([]);
    expect(result.config?.baseUrl).toBe("http://custom-ollama:11434");
  });

  it.each([
    [true, true],
    [false, false],
    ["true", true],
    ["false", false]
  ])("accepts logging=%p", (input, expected) => {
    const result = parseConfig({ model: "llama3.2", logging: input });

    expect(result.errors).toEqual([]);
    expect(result.config?.logging).toBe(expected);
  });

  it.each([
    [true, true],
    [false, false],
    ["true", true],
    ["false", false]
  ])("accepts streaming=%p", (input, expected) => {
    const result = parseConfig({ model: "llama3.2", streaming: input });

    expect(result.errors).toEqual([]);
    expect(result.config?.streaming).toBe(expected);
  });

  it("reads custom UI values from adapterSchemaValues when Paperclip nests schema fields", () => {
    const result = parseConfig({
      model: "llama3.2",
      adapterSchemaValues: {
        baseUrl: "http://ollama.example.test:11434",
        ollamaTimeoutSec: "45",
        logging: "true",
        streaming: "false",
        enableCommandExecution: "true",
        commandCwd: "/tmp",
        commandTimeoutSec: "15",
        maxToolCalls: "3",
        think: "high",
        skillSelectionMode: "llm"
      }
    });

    expect(result.errors).toEqual([]);
    expect(result.config).toMatchObject({
      model: "llama3.2",
      baseUrl: "http://ollama.example.test:11434",
      timeoutSec: DEFAULT_TIMEOUT_SEC,
      ollamaTimeoutSec: 45,
      logging: true,
      streaming: false,
      enableCommandExecution: true,
      commandCwd: "/tmp",
      commandTimeoutSec: 15,
      maxToolCalls: 3,
      think: "high",
      skillSelectionMode: "llm"
    });
  });

  it("applies command execution defaults", () => {
    const result = parseConfig({ model: "llama3.2" });

    expect(result.errors).toEqual([]);
    expect(result.config).toMatchObject({
      enableCommandExecution: false,
      streaming: true,
      ollamaTimeoutSec: 60,
      commandTimeoutSec: 120,
      maxToolCalls: 8,
      skillSelectionMode: "deterministic"
    });
  });

  it("rejects invalid command execution limits", () => {
    const result = parseConfig({
      model: "llama3.2",
      commandTimeoutSec: 0,
      maxToolCalls: 0,
      ollamaTimeoutSec: 0
    });

    expect(result.config).toBeNull();
    expect(result.errors).toContain("ollamaTimeoutSec must be greater than 0");
    expect(result.errors).toContain("commandTimeoutSec must be greater than 0");
    expect(result.errors).toContain("maxToolCalls must be a positive integer");
  });

  it.each([
    [true, true],
    [false, false],
    ["true", true],
    ["false", false],
    ["low", "low"],
    ["medium", "medium"],
    ["high", "high"]
  ])("accepts think=%p", (input, expected) => {
    const result = parseConfig({ model: "llama3.2", think: input });

    expect(result.errors).toEqual([]);
    expect(result.config?.think).toBe(expected);
  });

  it.each([
    ["thinkingEffort", "low"],
    ["thinkingEffort", "medium"],
    ["thinkingEffort", "high"],
    ["thinkingEffort", "false"]
  ])("maps Paperclip %s=%p to Ollama think", (key, value) => {
    const result = parseConfig({ model: "llama3.2", [key]: value });

    expect(result.errors).toEqual([]);
    expect(result.config?.think).toBe(value === "false" ? false : value);
  });

  it("rejects unsupported think values", () => {
    const result = parseConfig({ model: "llama3.2", think: "maximum" });

    expect(result.config).toBeNull();
    expect(result.errors).toContain('think must be true, false, "low", "medium", "high", or omitted');
  });

  it.each(["deterministic", "llm"])("accepts skillSelectionMode=%p", (mode) => {
    const result = parseConfig({ model: "llama3.2", skillSelectionMode: mode });

    expect(result.errors).toEqual([]);
    expect(result.config?.skillSelectionMode).toBe(mode);
  });

  it("rejects unsupported skillSelectionMode values", () => {
    const result = parseConfig({ model: "llama3.2", skillSelectionMode: "magic" });

    expect(result.config).toBeNull();
    expect(result.errors).toContain('skillSelectionMode must be "deterministic", "llm", or omitted');
  });
});
