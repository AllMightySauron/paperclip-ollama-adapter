import { describe, expect, it } from "vitest";
import { execute, resolveCommandCwd } from "./execute.js";

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

  it("defaults command cwd from Paperclip workspace context", () => {
    const cwd = resolveCommandCwd({
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
      context: {
        paperclipWorkspace: {
          cwd: "/paperclip/instances/default/projects/project-1/_default"
        }
      },
      onLog: async () => {}
    });

    expect(cwd).toBe("/paperclip/instances/default/projects/project-1/_default");
  });

  it("prefers explicit commandCwd over Paperclip workspace context", () => {
    const cwd = resolveCommandCwd({
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
      context: {
        paperclipWorkspace: {
          cwd: "/paperclip/instances/default/projects/project-1/_default"
        }
      },
      onLog: async () => {}
    }, "/tmp/override");

    expect(cwd).toBe("/tmp/override");
  });
});
