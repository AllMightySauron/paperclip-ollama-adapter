import { describe, expect, it } from "vitest";
import { DEFAULT_BASE_URL } from "../types.js";
import { buildConfigFromFormValues } from "./build-config.js";
import { getConfigSchema } from "./config-schema.js";

describe("getConfigSchema", () => {
  it("exposes Paperclip UI fields for all adapter config keys", () => {
    const schema = getConfigSchema();

    expect(schema.fields.map((field) => field.key)).toEqual([
      "baseUrl",
      "logging",
      "enableCommandExecution",
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
    expect(schema.fields.find((field) => field.key === "enableCommandExecution")).toMatchObject({
      type: "select",
      default: "false"
    });
  });

  it("does not define model because Paperclip renders the built-in model control", () => {
    expect(getConfigSchema().fields.some((field) => field.key === "model")).toBe(false);
  });

  it("does not define think because Paperclip renders the built-in thinking effort control", () => {
    expect(getConfigSchema().fields.some((field) => field.key === "think")).toBe(false);
  });

  it("does not define timeoutSec because Paperclip renders the built-in timeout control", () => {
    expect(getConfigSchema().fields.some((field) => field.key === "timeoutSec")).toBe(false);
  });
});

describe("buildConfigFromFormValues", () => {
  it("normalizes schema values into adapter config", () => {
    expect(buildConfigFromFormValues({
      model: " llama3.2 ",
      baseUrl: "",
      timeoutSec: "30",
      logging: "true",
      enableCommandExecution: "true",
      commandCwd: "/tmp",
      commandTimeoutSec: "20",
      maxToolCalls: "4",
      think: "medium"
    })).toMatchObject({
      model: "llama3.2",
      baseUrl: DEFAULT_BASE_URL,
      timeoutSec: 30,
      logging: true,
      enableCommandExecution: true,
      commandCwd: "/tmp",
      commandTimeoutSec: 20,
      maxToolCalls: 4,
      think: "medium"
    });
  });

  it("omits think when the default schema option is selected", () => {
    expect(buildConfigFromFormValues({
      model: "llama3.2",
      think: ""
    })).not.toHaveProperty("think");
  });
});
