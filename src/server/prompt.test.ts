import type { AdapterExecutionContext } from "@paperclipai/adapter-utils";
import { describe, expect, it } from "vitest";
import { buildPrompt } from "./prompt.js";

const baseContext: AdapterExecutionContext = {
  runId: "run-1",
  agent: {
    id: "agent-1",
    companyId: "company-1",
    name: "Ada",
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
    taskId: "task-1",
    wakeReason: "manual"
  },
  onLog: async () => {}
};

describe("buildPrompt", () => {
  it("renders prompt templates with Paperclip's template helper", () => {
    const prompt = buildPrompt(baseContext, {
      model: "llama3.2",
      baseUrl: "http://127.0.0.1:11434",
      timeoutSec: 120,
      promptTemplate: "Agent {{ agent.name }} handles {{context.taskId}} in {{company.id}} for {{run.id}}."
    });

    expect(prompt).toBe("Agent Ada handles task-1 in company-1 for run-1.");
  });

  it("includes formatted wake context JSON", () => {
    const prompt = buildPrompt(baseContext, {
      model: "llama3.2",
      baseUrl: "http://127.0.0.1:11434",
      timeoutSec: 120,
      promptTemplate: "Context:\n{{contextJson}}"
    });

    expect(prompt).toContain('"taskId": "task-1"');
    expect(prompt).toContain('"wakeReason": "manual"');
  });

  it("adds command tool guidance when command execution is enabled", () => {
    const prompt = buildPrompt(baseContext, {
      model: "llama3.2",
      baseUrl: "http://127.0.0.1:11434",
      timeoutSec: 120,
      enableCommandExecution: true,
      commandTimeoutSec: 120,
      maxToolCalls: 8
    });

    expect(prompt).toContain("Command execution is enabled through the run_command tool.");
    expect(prompt).toContain('Read a file: command="cat", args=["path/to/file.md"]');
    expect(prompt).toContain('List recursively: command="ls", args=["-R", "path/to/dir"]');
    expect(prompt).toContain('use command="sh" and args=["-lc", "..."]');
    expect(prompt).toContain("Find while suppressing errors");
    expect(prompt).toContain('Do not write args=["ls-R"].');
  });

  it("includes loaded SKILL.md-standard skills in the prompt", () => {
    const prompt = buildPrompt(baseContext, {
      model: "llama3.2",
      baseUrl: "http://127.0.0.1:11434",
      timeoutSec: 120,
      commandTimeoutSec: 120,
      maxToolCalls: 8
    }, [
      {
        name: "repo-review",
        description: "Use when reviewing repository changes.",
        path: "/workspace/skills/repo-review/SKILL.md",
        body: "Start with findings ordered by severity."
      }
    ]);

    expect(prompt).toContain("Available skills:");
    expect(prompt).toContain("## repo-review");
    expect(prompt).toContain("Description: Use when reviewing repository changes.");
    expect(prompt).toContain("Start with findings ordered by severity.");
  });
});
