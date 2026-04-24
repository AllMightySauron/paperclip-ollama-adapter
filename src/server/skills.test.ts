import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  listOllamaSkills,
  loadManagedSkills,
  parseSkillMarkdown,
  syncOllamaSkills
} from "./skills.js";

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

      await expect(loadManagedSkills(config)).resolves.toMatchObject({
        skills: [
          {
            name: "repo-review",
            description: "Use when reviewing repository changes.",
            body: "# Repo Review\n\nStart with findings."
          }
        ],
        warnings: []
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
