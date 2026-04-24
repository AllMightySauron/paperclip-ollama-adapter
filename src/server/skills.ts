import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type {
  AdapterSkillContext,
  AdapterSkillEntry,
  AdapterSkillSnapshot
} from "@paperclipai/adapter-utils";
import {
  readPaperclipRuntimeSkillEntries,
  readPaperclipSkillSyncPreference,
  resolvePaperclipDesiredSkillNames
} from "@paperclipai/adapter-utils/server-utils";
import { ADAPTER_TYPE, type OllamaSkill } from "../types.js";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

type ParsedSkillMarkdown = Pick<OllamaSkill, "name" | "description"> & { body: string };

export interface ManagedSkillLoadResult {
  skills: OllamaSkill[];
  warnings: string[];
}

export async function listOllamaSkills(
  ctx: AdapterSkillContext
): Promise<AdapterSkillSnapshot> {
  return buildOllamaSkillSnapshot(ctx.config);
}

export async function syncOllamaSkills(
  ctx: AdapterSkillContext,
  desiredSkills: string[]
): Promise<AdapterSkillSnapshot> {
  return buildOllamaSkillSnapshot(ctx.config, desiredSkills);
}

export function resolveOllamaDesiredSkillNames(
  config: Record<string, unknown>,
  availableEntries: Array<{ key: string; required?: boolean }>
): string[] {
  return resolvePaperclipDesiredSkillNames(config, availableEntries);
}

export async function loadManagedSkills(
  config: Record<string, unknown>,
  wakeContext: unknown
): Promise<ManagedSkillLoadResult> {
  const availableEntries = await readPaperclipRuntimeSkillEntries(config, moduleDir);
  const desiredSkills = resolvePaperclipDesiredSkillNames(config, availableEntries);
  const explicitlyDesiredSkills = resolveExplicitDesiredSkillNames(config, availableEntries);
  const availableByKey = new Map(availableEntries.map((entry) => [entry.key, entry]));
  const skills: OllamaSkill[] = [];
  const warnings: string[] = [];
  const wakeText = buildWakeText(wakeContext);

  for (const desiredSkill of desiredSkills) {
    const entry = availableByKey.get(desiredSkill);
    if (!entry) {
      warnings.push(`Desired Paperclip skill "${desiredSkill}" is not available.`);
      continue;
    }

    try {
      const skillPath = path.join(entry.source, "SKILL.md");
      const parsed = parseSkillMarkdown(await readFile(skillPath, "utf8"));
      const includeBody = explicitlyDesiredSkills.has(entry.key)
        || skillMatchesWake(parsed, entry, wakeText);
      skills.push({
        ...parsed,
        key: entry.key,
        path: skillPath,
        body: includeBody ? parsed.body : null,
        includeBody,
        required: Boolean(entry.required)
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      warnings.push(`${desiredSkill}: ${message}`);
    }
  }

  return { skills, warnings };
}

function resolveExplicitDesiredSkillNames(
  config: Record<string, unknown>,
  availableEntries: Array<{ key: string; runtimeName?: string | null }>
): Set<string> {
  const preference = readPaperclipSkillSyncPreference(config);
  if (!preference.explicit) {
    return new Set();
  }

  return new Set(
    preference.desiredSkills
      .map((desiredSkill) => canonicalizeSkillReference(desiredSkill, availableEntries))
      .filter((desiredSkill) => desiredSkill !== "")
  );
}

function canonicalizeSkillReference(
  reference: string,
  availableEntries: Array<{ key: string; runtimeName?: string | null }>
): string {
  const normalized = normalizeSearchText(reference);
  if (!normalized) {
    return "";
  }

  const byKey = availableEntries.find((entry) => normalizeSearchText(entry.key) === normalized);
  if (byKey) {
    return byKey.key;
  }

  const byRuntimeName = availableEntries.filter(
    (entry) => normalizeSearchText(entry.runtimeName ?? "") === normalized
  );
  if (byRuntimeName.length === 1) {
    return byRuntimeName[0]?.key ?? "";
  }

  const bySlug = availableEntries.filter((entry) => normalizeSearchText(entry.key.split("/").pop() ?? "") === normalized);
  if (bySlug.length === 1) {
    return bySlug[0]?.key ?? "";
  }

  return normalized;
}

function buildWakeText(value: unknown): string {
  const terms: string[] = [];
  collectWakeText(value, terms);
  return normalizeSearchText(terms.join(" "));
}

function collectWakeText(value: unknown, terms: string[]): void {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    terms.push(String(value));
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      collectWakeText(item, terms);
    }
    return;
  }
  if (typeof value !== "object" || value === null) {
    return;
  }

  const record = value as Record<string, unknown>;
  for (const key of ["title", "description", "body", "summary", "wakeReason", "source"]) {
    collectWakeText(record[key], terms);
  }
  collectWakeText(record.issue, terms);
  collectWakeText(record.paperclipWake, terms);
}

function skillMatchesWake(
  skill: ParsedSkillMarkdown,
  entry: { key: string; runtimeName?: string | null },
  wakeText: string
): boolean {
  if (!wakeText) {
    return false;
  }

  const candidates = [
    skill.name,
    skill.description,
    entry.runtimeName ?? "",
    entry.key.split("/").pop() ?? ""
  ]
    .flatMap((value) => tokenizeSkillText(value))
    .filter((token) => !isGenericSkillToken(token));

  return candidates.some((token) => wakeText.includes(token));
}

function tokenizeSkillText(value: string): string[] {
  return Array.from(new Set(normalizeSearchText(value)
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 4)));
}

function isGenericSkillToken(token: string): boolean {
  return [
    "skill",
    "paperclip",
    "agent",
    "agents",
    "create",
    "when",
    "with",
    "this",
    "that",
    "from",
    "your",
    "task",
    "issue"
  ].includes(token);
}

function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

async function buildOllamaSkillSnapshot(
  config: Record<string, unknown>,
  desiredOverride?: string[]
): Promise<AdapterSkillSnapshot> {
  const availableEntries = await readPaperclipRuntimeSkillEntries(config, moduleDir);
  const availableByKey = new Map(availableEntries.map((entry) => [entry.key, entry]));
  const desiredSkills = desiredOverride
    ? resolvePaperclipDesiredSkillNames({
        ...config,
        paperclipSkillSync: { desiredSkills: desiredOverride }
      }, availableEntries)
    : resolvePaperclipDesiredSkillNames(config, availableEntries);
  const desiredSet = new Set(desiredSkills);
  const entries: AdapterSkillEntry[] = availableEntries.map((entry) => ({
    key: entry.key,
    runtimeName: entry.runtimeName,
    desired: desiredSet.has(entry.key),
    managed: true,
    state: desiredSet.has(entry.key) ? "configured" : "available",
    origin: entry.required ? "paperclip_required" : "company_managed",
    originLabel: entry.required ? "Required by Paperclip" : "Managed by Paperclip",
    readOnly: false,
    sourcePath: entry.source,
    targetPath: null,
    detail: desiredSet.has(entry.key)
      ? "Will be injected into the Ollama prompt on the next run."
      : null,
    required: Boolean(entry.required),
    requiredReason: entry.requiredReason ?? null
  }));
  const warnings: string[] = [];

  for (const desiredSkill of desiredSkills) {
    if (availableByKey.has(desiredSkill)) {
      continue;
    }

    warnings.push(`Desired skill "${desiredSkill}" is not available from the Paperclip skills directory.`);
    entries.push({
      key: desiredSkill,
      runtimeName: null,
      desired: true,
      managed: true,
      state: "missing",
      origin: "external_unknown",
      originLabel: "External or unavailable",
      readOnly: false,
      sourcePath: null,
      targetPath: null,
      detail: "Paperclip cannot find this skill in the local runtime skills directory."
    });
  }

  entries.sort((left, right) => left.key.localeCompare(right.key));

  return {
    adapterType: ADAPTER_TYPE,
    supported: true,
    mode: "ephemeral",
    desiredSkills,
    entries,
    warnings
  };
}

export function parseSkillMarkdown(content: string): ParsedSkillMarkdown {
  const normalized = content.replace(/^\uFEFF/, "");
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(normalized);
  if (!match) {
    throw new Error("SKILL.md must start with YAML frontmatter");
  }

  const frontmatter = parseSimpleFrontmatter(match[1] ?? "");
  const name = frontmatter.name?.trim();
  const description = frontmatter.description?.trim();

  if (!name) {
    throw new Error("SKILL.md frontmatter must include name");
  }
  if (!description) {
    throw new Error("SKILL.md frontmatter must include description");
  }

  return {
    name,
    description,
    body: (match[2] ?? "").trim()
  };
}

function parseSimpleFrontmatter(frontmatter: string): Record<string, string> {
  const result: Record<string, string> = {};
  const lines = frontmatter.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) {
      continue;
    }

    const separator = trimmed.indexOf(":");
    if (separator === -1) {
      continue;
    }

    const key = trimmed.slice(0, separator).trim();
    const rawValue = trimmed.slice(separator + 1).trim();
    if (key === "") {
      continue;
    }

    if (rawValue === ">" || rawValue === "|") {
      const blockLines: string[] = [];
      for (let blockIndex = index + 1; blockIndex < lines.length; blockIndex += 1) {
        const blockLine = lines[blockIndex] ?? "";
        if (blockLine.trim() !== "" && !/^\s/.test(blockLine)) {
          break;
        }

        blockLines.push(blockLine.replace(/^\s{2}/, ""));
        index = blockIndex;
      }

      result[key] = rawValue === ">"
        ? blockLines.map((blockLine) => blockLine.trim()).filter(Boolean).join(" ")
        : blockLines.join("\n").trim();
      continue;
    }

    result[key] = stripYamlQuotes(rawValue);
  }

  return result;
}

function stripYamlQuotes(value: string): string {
  if (value.length < 2) {
    return value;
  }

  const quote = value[0];
  if ((quote === "\"" || quote === "'") && value[value.length - 1] === quote) {
    return value.slice(1, -1);
  }

  return value;
}
