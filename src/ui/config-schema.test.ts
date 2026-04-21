import { describe, expect, it } from "vitest";
import { DEFAULT_BASE_URL, DEFAULT_TIMEOUT_SEC } from "../types.js";
import { buildConfigFromFormValues } from "./build-config.js";
import { getConfigSchema } from "./config-schema.js";

describe("getConfigSchema", () => {
  it("exposes Paperclip UI fields for all adapter config keys", () => {
    const schema = getConfigSchema();

    expect(schema.fields.map((field) => field.key)).toEqual([
      "model",
      "baseUrl",
      "timeoutSec",
      "think",
      "instructions",
      "promptTemplate"
    ]);
    expect(schema.fields.find((field) => field.key === "model")).toMatchObject({
      type: "combobox",
      required: true
    });
    expect(schema.fields.find((field) => field.key === "baseUrl")?.default)
      .toBe(DEFAULT_BASE_URL);
    expect(schema.fields.find((field) => field.key === "timeoutSec")?.default)
      .toBe(DEFAULT_TIMEOUT_SEC);
  });

  it("uses string values for think options so UI form values can be normalized", () => {
    const thinkField = getConfigSchema().fields.find((field) => field.key === "think");

    expect(thinkField?.type).toBe("select");
    expect(thinkField?.options?.map((option) => option.value)).toEqual([
      "",
      "true",
      "false",
      "low",
      "medium",
      "high"
    ]);
  });
});

describe("buildConfigFromFormValues", () => {
  it("normalizes schema values into adapter config", () => {
    expect(buildConfigFromFormValues({
      model: " llama3.2 ",
      baseUrl: "",
      timeoutSec: "30",
      think: "medium"
    })).toMatchObject({
      model: "llama3.2",
      baseUrl: DEFAULT_BASE_URL,
      timeoutSec: 30,
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
