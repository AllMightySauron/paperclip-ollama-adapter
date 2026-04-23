import { describe, expect, it } from "vitest";
import { parseRunCommandInput } from "./commands.js";

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

  it("shell-quotes args when direct args include shell-only syntax", () => {
    expect(parseRunCommandInput({
      command: "grep",
      args: ["hello world", "README.md"]
    })).toEqual({
      command: "sh",
      args: ["-lc", "grep 'hello world' 'README.md'"]
    });
  });
});
