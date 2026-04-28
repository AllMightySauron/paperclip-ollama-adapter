import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  listOllamaSkills,
  loadManagedSkills,
  parseSkillMarkdown,
  syncOllamaSkills
} from "./skills.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("parseSkillMarkdown", () => {
  it("parses SKILL.md frontmatter and body", () => {
    expect(parseSkillMarkdown(`---
name: repo-review
description: Use when reviewing repository changes.
---

# Repo Review

Start with findings.`)).toEqual({
      name: "repo-review",
      description: "Use when reviewing repository changes.",
      body: "# Repo Review\n\nStart with findings."
    });
  });

  it("parses folded YAML frontmatter descriptions", () => {
    expect(parseSkillMarkdown(`---
name: paperclip
description: >
  Use when working inside Paperclip heartbeats.
  Includes API workflow.
---

# Paperclip`)).toMatchObject({
      name: "paperclip",
      description: "Use when working inside Paperclip heartbeats. Includes API workflow."
    });
  });

  it("requires standard name and description frontmatter", () => {
    expect(() => parseSkillMarkdown("# Missing frontmatter"))
      .toThrow("SKILL.md must start with YAML frontmatter");

    expect(() => parseSkillMarkdown(`---
name: incomplete
---

# Incomplete`)).toThrow("SKILL.md frontmatter must include description");
  });
});

describe("Paperclip-managed skill sync", () => {
  it("lists, syncs, and loads configured runtime skills", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "ollama-skill-test-"));
    const skillDir = path.join(root, "repo-review");
    await mkdir(skillDir, { recursive: true });
    await writeFile(path.join(skillDir, "SKILL.md"), `---
name: repo-review
description: Use when reviewing repository changes.
---

# Repo Review

Start with findings.`);

    const config = {
      paperclipRuntimeSkills: [
        {
          key: "paperclipai/paperclip/repo-review",
          runtimeName: "repo-review",
          source: skillDir,
          required: false
        }
      ],
      paperclipSkillSync: {
        desiredSkills: ["repo-review"]
      }
    };

    try {
      await expect(listOllamaSkills({
        agentId: "agent-1",
        companyId: "company-1",
        adapterType: "ollama_local",
        config
      })).resolves.toMatchObject({
        adapterType: "ollama_local",
        supported: true,
        mode: "ephemeral",
        desiredSkills: ["paperclipai/paperclip/repo-review"],
        entries: [
          {
            key: "paperclipai/paperclip/repo-review",
            desired: true,
            state: "configured"
          }
        ]
      });

      await expect(syncOllamaSkills({
        agentId: "agent-1",
        companyId: "company-1",
        adapterType: "ollama_local",
        config
      }, ["paperclipai/paperclip/repo-review"])).resolves.toMatchObject({
        desiredSkills: ["paperclipai/paperclip/repo-review"]
      });

      await expect(loadManagedSkills(config, {
        paperclipWake: {
          issue: {
            title: "Review repository changes"
          }
        }
      })).resolves.toMatchObject({
        skills: [
          {
            name: "repo-review",
            description: "Use when reviewing repository changes.",
            body: "# Repo Review\n\nStart with findings.",
            includeBody: true
          }
        ],
        warnings: []
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("keeps required but non-matching skills as metadata only", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "ollama-skill-test-"));
    const skillDir = path.join(root, "paperclip-create-agent");
    await mkdir(skillDir, { recursive: true });
    await writeFile(path.join(skillDir, "SKILL.md"), `---
name: paperclip-create-agent
description: Use when hiring or creating agents.
---

# Create Agent

Long instructions.`);

    const config = {
      paperclipRuntimeSkills: [
        {
          key: "paperclipai/paperclip/paperclip-create-agent",
          runtimeName: "paperclip-create-agent",
          source: skillDir,
          required: true
        }
      ]
    };

    try {
      await expect(loadManagedSkills(config, {
        paperclipWake: {
          issue: {
            title: "Say hello"
          }
        }
      })).resolves.toMatchObject({
        skills: [
          {
            name: "paperclip-create-agent",
            description: "Use when hiring or creating agents.",
            body: null,
            includeBody: false,
            required: true
          }
        ],
        warnings: []
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("uses Ollama to classify required skill body inclusion", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "ollama-skill-test-"));
    const skillDir = path.join(root, "paperclip-create-agent");
    await mkdir(skillDir, { recursive: true });
    await writeFile(path.join(skillDir, "SKILL.md"), `---
name: paperclip-create-agent
description: Use when hiring or creating agents.
---

# Create Agent

Long instructions.`);

    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      message: {
        content: JSON.stringify({
          skillKeys: ["paperclipai/paperclip/paperclip-create-agent"]
        })
      }
    })));
    vi.stubGlobal("fetch", fetchMock);
    const logs: Array<{ stream: "stdout" | "stderr"; chunk: string }> = [];

    const config = {
      paperclipRuntimeSkills: [
        {
          key: "paperclipai/paperclip/paperclip-create-agent",
          runtimeName: "paperclip-create-agent",
          source: skillDir,
          required: true
        }
      ]
    };

    try {
      await expect(loadManagedSkills(config, {
        paperclipWake: {
          issue: {
            title: "Bring on a CTO"
          }
        }
      }, {
        config: {
          model: "qwen3.5:0.8b",
          baseUrl: "http://ollama.local:11434",
          timeoutSec: 30,
          ollamaTimeoutSec: 45,
          commandTimeoutSec: 120,
          maxToolCalls: 8,
          logging: true,
          skillSelectionMode: "llm"
        },
        onLog: async (stream, chunk) => {
          logs.push({ stream, chunk });
        }
      })).resolves.toMatchObject({
        skills: [
          {
            name: "paperclip-create-agent",
            body: "# Create Agent\n\nLong instructions.",
            includeBody: true
          }
        ],
        warnings: []
      });

      expect(fetchMock).toHaveBeenCalledWith(
        "http://ollama.local:11434/api/chat",
        expect.objectContaining({
          method: "POST",
          dispatcher: expect.any(Object),
          body: expect.stringContaining("\"stream\":true")
        })
      );
      const joinedLogs = logs.map((log) => log.chunk).join("\n");
      expect(joinedLogs).toContain("Classifying Paperclip skills");
      expect(joinedLogs).toContain("requestBody");
      expect(joinedLogs).toContain("Bring on a CTO");
      expect(joinedLogs).toContain("paperclip-create-agent");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("falls back to deterministic matching when classification fails", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "ollama-skill-test-"));
    const skillDir = path.join(root, "repo-review");
    await mkdir(skillDir, { recursive: true });
    await writeFile(path.join(skillDir, "SKILL.md"), `---
name: repo-review
description: Use when reviewing repository changes.
---

# Repo Review

Review instructions.`);

    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("offline");
    }));

    const config = {
      paperclipRuntimeSkills: [
        {
          key: "paperclipai/paperclip/repo-review",
          runtimeName: "repo-review",
          source: skillDir,
          required: true
        }
      ]
    };

    try {
      const result = await loadManagedSkills(config, {
        paperclipWake: {
          issue: {
            title: "Review repository changes"
          }
        }
      }, {
        config: {
          model: "qwen3.5:0.8b",
          baseUrl: "http://ollama.local:11434",
          timeoutSec: 30,
          ollamaTimeoutSec: 45,
          commandTimeoutSec: 120,
          maxToolCalls: 8,
          skillSelectionMode: "llm"
        }
      });

      expect(result.skills).toMatchObject([
        {
          name: "repo-review",
          body: "# Repo Review\n\nReview instructions.",
          includeBody: true
        }
      ]);
      expect(result.warnings.join("\n")).toContain("Skill classifier failed");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("does not call the classifier in deterministic mode", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "ollama-skill-test-"));
    const skillDir = path.join(root, "repo-review");
    await mkdir(skillDir, { recursive: true });
    await writeFile(path.join(skillDir, "SKILL.md"), `---
name: repo-review
description: Use when reviewing repository changes.
---

# Repo Review

Review instructions.`);

    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const config = {
      paperclipRuntimeSkills: [
        {
          key: "paperclipai/paperclip/repo-review",
          runtimeName: "repo-review",
          source: skillDir,
          required: true
        }
      ]
    };

    try {
      const result = await loadManagedSkills(config, {
        paperclipWake: {
          issue: {
            title: "Review repository changes"
          }
        }
      }, {
        config: {
          model: "qwen3.5:0.8b",
          baseUrl: "http://ollama.local:11434",
          timeoutSec: 30,
          ollamaTimeoutSec: 45,
          commandTimeoutSec: 120,
          maxToolCalls: 8,
          skillSelectionMode: "deterministic"
        }
      });

      expect(fetchMock).not.toHaveBeenCalled();
      expect(result.skills).toMatchObject([
        {
          name: "repo-review",
          body: "# Repo Review\n\nReview instructions.",
          includeBody: true
        }
      ]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
