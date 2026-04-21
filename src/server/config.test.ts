import { describe, expect, it } from "vitest";
import { DEFAULT_BASE_URL, DEFAULT_TIMEOUT_SEC } from "../types.js";
import { parseConfig } from "./config.js";

describe("parseConfig", () => {
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
      timeoutSec: DEFAULT_TIMEOUT_SEC
    });
  });
});
