import { describe, expect, it } from "vitest";
import { buildToolEnv, execute, resolveCommandCwd } from "./execute.js";

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

describe("buildToolEnv", () => {
  it("builds PAPERCLIP_* tool env vars from execution context", () => {
    expect(buildToolEnv({
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
        taskKey: "task-key-1"
      },
      config: {},
      context: {
        taskId: "task-1",
        wakeReason: "manual",
        wakeCommentId: "comment-1",
        approvalId: "approval-1",
        approvalStatus: "approved",
        linkedIssueIds: ["issue-1", "issue-2"],
        wakePayload: {
          latestCommentId: "comment-1"
        },
        paperclipWorkspace: {
          cwd: "/paperclip/workspace"
        }
      },
      onLog: async () => {}
    })).toEqual({
      PAPERCLIP_AGENT_ID: "agent-1",
      PAPERCLIP_APPROVAL_ID: "approval-1",
      PAPERCLIP_APPROVAL_STATUS: "approved",
      PAPERCLIP_COMPANY_ID: "company-1",
      PAPERCLIP_LINKED_ISSUE_IDS: "issue-1,issue-2",
      PAPERCLIP_RUN_ID: "run-1",
      PAPERCLIP_TASK_ID: "task-1",
      PAPERCLIP_WAKE_COMMENT_ID: "comment-1",
      PAPERCLIP_WAKE_PAYLOAD_JSON: "{\"latestCommentId\":\"comment-1\"}",
      PAPERCLIP_WAKE_REASON: "manual",
      PAPERCLIP_WORKSPACE_CWD: "/paperclip/workspace"
    });
  });

  it("passes through string wake payload and linked issue values", () => {
    expect(buildToolEnv({
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
        linkedIssueIds: "issue-1,issue-2",
        wakePayloadJson: "{\"latestCommentId\":\"comment-1\"}"
      },
      onLog: async () => {}
    })).toMatchObject({
      PAPERCLIP_LINKED_ISSUE_IDS: "issue-1,issue-2",
      PAPERCLIP_WAKE_PAYLOAD_JSON: "{\"latestCommentId\":\"comment-1\"}"
    });
  });

  it("falls back to runtime taskKey when context taskId is unavailable", () => {
    expect(buildToolEnv({
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
        taskKey: "task-key-1"
      },
      config: {},
      context: {},
      onLog: async () => {}
    }).PAPERCLIP_TASK_ID).toBe("task-key-1");
  });
});
