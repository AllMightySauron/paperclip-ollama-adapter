import { describe, expect, it } from "vitest";
import { parseRunCommandInput, readPaperclipEnv, resolveRunCommandCwd } from "./commands.js";

describe("parseRunCommandInput", () => {
  it("accepts direct command arguments", () => {
    expect(parseRunCommandInput({
      command: "npm",
      args: ["test"],
      cwd: "/tmp",
      stdin: "input"
    })).toEqual({
      command: "npm",
      args: ["test"],
      cwd: "/tmp",
      stdin: "input"
    });
  });

  it("rejects non-string args", () => {
    expect(() => parseRunCommandInput({
      command: "npm",
      args: ["test", 1]
    })).toThrow("run_command.args must be an array of strings");
  });

  it("normalizes Gemma-style command artifacts from the first arg", () => {
    expect(parseRunCommandInput({
      command: "ls",
      args: ["<|\"|ls-R<|\"|", "doc/plans"]
    })).toEqual({
      command: "ls",
      args: ["-R", "doc/plans"]
    });
  });

  it("runs shell command strings through sh -lc when they contain redirects", () => {
    expect(parseRunCommandInput({
      command: "find /paperclip -name \"hiring_plan.md\" 2>/dev/null"
    })).toEqual({
      command: "sh",
      args: ["-lc", "find /paperclip -name \"hiring_plan.md\" 2>/dev/null"]
    });
  });

  it("preserves explicit shell invocations", () => {
    expect(parseRunCommandInput({
      command: "sh",
      args: ["-lc", "npm test && npm run build"]
    })).toEqual({
      command: "sh",
      args: ["-lc", "npm test && npm run build"]
    });
  });

  it("preserves quotes in explicit shell command strings", () => {
    expect(parseRunCommandInput({
      command: "sh",
      args: [
        "-lc",
        "curl -sS \"$PAPERCLIP_API_URL/api/agents/me\" -H \"Authorization: Bearer $PAPERCLIP_API_KEY\""
      ]
    })).toEqual({
      command: "sh",
      args: [
        "-lc",
        "curl -sS \"$PAPERCLIP_API_URL/api/agents/me\" -H \"Authorization: Bearer $PAPERCLIP_API_KEY\""
      ]
    });
  });

  it("shell-quotes split explicit shell invocation args with whitespace", () => {
    expect(parseRunCommandInput({
      command: "sh",
      args: [
        "-lc",
        "curl",
        "-sS",
        "$PAPERCLIP_API_URL/api/agents/me/inbox-lite",
        "-H",
        "Authorization: Bearer $PAPERCLIP_API_KEY",
        "-H",
        "X-Paperclip-Run-Id: $PAPERCLIP_RUN_ID"
      ]
    })).toEqual({
      command: "sh",
      args: [
        "-lc",
        "curl -sS \"$PAPERCLIP_API_URL/api/agents/me/inbox-lite\" -H \"Authorization: Bearer $PAPERCLIP_API_KEY\" -H \"X-Paperclip-Run-Id: $PAPERCLIP_RUN_ID\""
      ]
    });
  });

  it("shell-quotes args when direct args include shell-only syntax", () => {
    expect(parseRunCommandInput({
      command: "grep",
      args: ["hello world", "README.md"]
    })).toEqual({
      command: "sh",
      args: ["-lc", "grep 'hello world' README.md"]
    });
  });
});

describe("resolveRunCommandCwd", () => {
  it("keeps absolute command cwd values", () => {
    expect(resolveRunCommandCwd("/paperclip/workspace", "/default"))
      .toBe("/paperclip/workspace");
  });

  it("repairs Paperclip absolute paths emitted without a leading slash", () => {
    expect(resolveRunCommandCwd(
      "paperclip/instances/default/projects/project-1/_default",
      "/paperclip/instances/default/workspaces/agent-home"
    )).toBe("/paperclip/instances/default/projects/project-1/_default");
  });

  it("resolves other relative cwd values from the default cwd", () => {
    expect(resolveRunCommandCwd("subdir", "/paperclip/workspace"))
      .toBe("/paperclip/workspace/subdir");
  });
});

describe("readPaperclipEnv", () => {
  it("returns sorted PAPERCLIP_* env vars only", () => {
    expect(readPaperclipEnv({
      PATH: "/bin",
      PAPERCLIP_RUN_ID: "run-1",
      PAPERCLIP_API_KEY: "key",
      PAPERCLIP_TASK_ID: "task-1"
    })).toEqual({
      PAPERCLIP_API_KEY: "key",
      PAPERCLIP_RUN_ID: "run-1",
      PAPERCLIP_TASK_ID: "task-1"
    });
  });
});
