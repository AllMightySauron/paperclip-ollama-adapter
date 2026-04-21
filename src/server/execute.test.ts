import { describe, expect, it } from "vitest";
import { execute } from "./execute.js";

describe("execute", () => {
  it("returns a structured config error when model is missing", async () => {
    const result = await execute({
      runId: "run-1",
      agent: {
        id: "agent-1",
        companyId: "company-1",
        name: "Test Agent",
        adapterType: "ollama_local",
        adapterConfig: {}
      },
      runtime: {
        sessionId: null,
        sessionParams: null,
        sessionDisplayId: null,
        taskKey: null
      },
      config: {},
      context: {},
      onLog: async () => {}
    });

    expect(result.exitCode).toBe(1);
    expect(result.errorCode).toBe("config_invalid");
  });
});
