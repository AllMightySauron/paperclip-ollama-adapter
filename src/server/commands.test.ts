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
});
