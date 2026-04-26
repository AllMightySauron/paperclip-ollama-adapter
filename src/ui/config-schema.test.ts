import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_BASE_URL } from "../types.js";
import { buildConfigFromFormValues } from "./build-config.js";
import { getConfigSchema } from "./config-schema.js";

describe("getConfigSchema", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("exposes Paperclip UI fields for all adapter config keys", () => {
    const schema = getConfigSchema();

    expect(schema.fields.map((field) => field.key)).toEqual([
      "baseUrl",
      "logging",
      "ollamaTimeoutSec",
      "think",
      "enableCommandExecution",
      "skillSelectionMode",
      "commandCwd",
      "commandTimeoutSec",
      "maxToolCalls",
      "instructions",
      "promptTemplate"
    ]);
    expect(schema.fields.find((field) => field.key === "baseUrl")?.default)
      .toBe(DEFAULT_BASE_URL);
    expect(schema.fields.find((field) => field.key === "logging")).toMatchObject({
      type: "select",
      default: "false"
    });
    expect(schema.fields.find((field) => field.key === "ollamaTimeoutSec")).toMatchObject({
      type: "number",
      default: 60
    });
    expect(schema.fields.find((field) => field.key === "enableCommandExecution")).toMatchObject({
      type: "select",
      default: "false"
    });
    expect(schema.fields.find((field) => field.key === "think")).toMatchObject({
      type: "select",
      default: "",
      options: [
        { label: "Auto", value: "" },
        { label: "Off", value: "false" },
        { label: "Low", value: "low" },
        { label: "Medium", value: "medium" },
        { label: "High", value: "high" }
      ]
    });
    expect(schema.fields.find((field) => field.key === "skillSelectionMode")).toMatchObject({
      type: "select",
      default: "deterministic",
      options: [
        { label: "Deterministic", value: "deterministic" },
        { label: "LLM", value: "llm" }
      ]
    });
  });

  it("defaults baseUrl from OLLAMA_BASE_URL when present", () => {
    vi.stubEnv("OLLAMA_BASE_URL", "http://ollama:11434");

    expect(getConfigSchema().fields.find((field) => field.key === "baseUrl")?.default)
      .toBe("http://ollama:11434");
  });

  it("does not define model because Paperclip renders the built-in model control", () => {
    expect(getConfigSchema().fields.some((field) => field.key === "model")).toBe(false);
  });

  it("defines a custom think field so users can set Off", () => {
    expect(getConfigSchema().fields.some((field) => field.key === "think")).toBe(true);
  });

  it("does not define timeoutSec because Paperclip renders the built-in timeout control", () => {
    expect(getConfigSchema().fields.some((field) => field.key === "timeoutSec")).toBe(false);
  });
});

describe("buildConfigFromFormValues", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("normalizes schema values into adapter config", () => {
    expect(buildConfigFromFormValues({
      model: " llama3.2 ",
      baseUrl: "",
      timeoutSec: "30",
      ollamaTimeoutSec: "45",
      logging: "true",
      enableCommandExecution: "true",
      commandCwd: "/tmp",
      commandTimeoutSec: "20",
      maxToolCalls: "4",
      think: "medium",
      skillSelectionMode: "llm"
    })).toMatchObject({
      model: "llama3.2",
      baseUrl: DEFAULT_BASE_URL,
      timeoutSec: 30,
      ollamaTimeoutSec: 45,
      logging: true,
      enableCommandExecution: true,
      commandCwd: "/tmp",
      commandTimeoutSec: 20,
      maxToolCalls: 4,
      think: "medium",
      skillSelectionMode: "llm"
    });
  });

  it("defaults empty form baseUrl from OLLAMA_BASE_URL when present", () => {
    vi.stubEnv("OLLAMA_BASE_URL", "http://ollama:11434");

    expect(buildConfigFromFormValues({
      model: "llama3.2",
      baseUrl: ""
    })).toMatchObject({
      baseUrl: "http://ollama:11434"
    });
  });

  it("omits think when the default schema option is selected", () => {
    expect(buildConfigFromFormValues({
      model: "llama3.2",
      think: ""
    })).not.toHaveProperty("think");
  });

  it("maps Off to think=false", () => {
    expect(buildConfigFromFormValues({
      model: "llama3.2",
      think: "false"
    })).toMatchObject({
      think: false
    });
  });
});
