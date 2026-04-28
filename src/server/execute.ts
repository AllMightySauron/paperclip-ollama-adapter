import type {
  AdapterExecutionContext,
  AdapterExecutionResult
} from "@paperclipai/adapter-utils";
import { ADAPTER_TYPE } from "../types.js";
import { parseConfig } from "./config.js";
import { invokeOllama } from "./ollama.js";
import { buildPrompt } from "./prompt.js";
import { parseSession } from "./session.js";
import { loadManagedSkills } from "./skills.js";

/**
 * Paperclip server entrypoint for a single adapter run.
 *
 * It validates config, renders the Paperclip prompt, calls Ollama, and maps the
 * provider result back into Paperclip's `AdapterExecutionResult` contract.
 */
export async function execute(
  ctx: AdapterExecutionContext
): Promise<AdapterExecutionResult> {
  const { config, errors } = parseConfig(ctx.config);
  if (!config) {
    return {
      exitCode: 1,
      signal: null,
      timedOut: false,
      errorMessage: errors.join("; "),
      errorCode: "config_invalid",
      errorMeta: { errors }
    };
  }

  await ctx.onLog("stdout", `[${ADAPTER_TYPE}] Starting run ${ctx.runId}\n`);
  await logDebug(ctx, config.logging, "Parsed adapter config", {
    model: config.model,
    baseUrl: config.baseUrl,
    timeoutSec: config.timeoutSec,
    ollamaTimeoutSec: config.ollamaTimeoutSec,
    logging: config.logging ?? false,
    enableCommandExecution: config.enableCommandExecution ?? false,
    commandCwd: config.commandCwd ?? null,
    commandTimeoutSec: config.commandTimeoutSec,
    maxToolCalls: config.maxToolCalls,
    skillSelectionMode: config.skillSelectionMode,
    hasInstructions: Boolean(config.instructions),
    hasPromptTemplate: Boolean(config.promptTemplate),
    think: config.think ?? null
  });

  const resolvedCommandCwd = resolveCommandCwd(ctx, config.commandCwd);
  await logDebug(ctx, config.logging, "Resolved command working directory", {
    source: readCommandCwdSource(ctx, config.commandCwd),
    cwd: resolvedCommandCwd
  });
  const loadedSkills = await loadManagedSkills(ctx.config, ctx.context, {
    config,
    onLog: ctx.onLog
  });
  for (const warning of loadedSkills.warnings) {
    await ctx.onLog("stderr", `[${ADAPTER_TYPE}:skills] ${warning}\n`);
  }
  if (loadedSkills.skills.length > 0) {
    await ctx.onLog(
      "stdout",
      `[${ADAPTER_TYPE}:skills] Loaded ${loadedSkills.skills.length} skill(s): ${loadedSkills.skills.map((skill) => skill.includeBody ? skill.name : `${skill.name} (metadata)`).join(", ")}\n`
    );
  }

  const prompt = buildPrompt(ctx, config, loadedSkills.skills);
  await logDebug(ctx, config.logging, "Rendered prompt", {
    length: prompt.length,
    skills: loadedSkills.skills.map((skill) => ({
      name: skill.name,
      path: skill.path
    })),
    prompt
  });

  const result = await invokeOllama({
    baseUrl: config.baseUrl,
    model: config.model,
    prompt,
    timeoutMs: config.ollamaTimeoutSec * 1000,
    session: parseSession(ctx.runtime.sessionParams),
    runId: ctx.runId,
    onLog: ctx.onLog,
    toolEnv: buildToolEnv(ctx),
    ...(ctx.onSpawn ? { onSpawn: ctx.onSpawn } : {}),
    commandExecution: {
      enabled: config.enableCommandExecution ?? false,
      cwd: resolvedCommandCwd,
      timeoutSec: config.commandTimeoutSec,
      maxToolCalls: config.maxToolCalls
    },
    ...(config.logging !== undefined ? { logging: config.logging } : {}),
    ...(config.instructions ? { instructions: config.instructions } : {}),
    ...(config.think !== undefined ? { think: config.think } : {})
  });

  if (!result.success) {
    await ctx.onLog("stderr", `[${ADAPTER_TYPE}] ${result.error ?? "Invocation failed"}\n`);
  }

  return {
    exitCode: result.success ? 0 : 1,
    signal: null,
    timedOut: result.timedOut,
    errorMessage: result.success ? null : result.error ?? "Ollama invocation failed",
    errorCode: result.success ? null : result.errorCode ?? "ollama_invocation_failed",
    usage: result.usage,
    provider: "ollama",
    model: result.model,
    billingType: "unknown",
    costUsd: result.costUsd,
    summary: result.summary,
    resultJson: result.raw,
    sessionId: result.session?.sessionId ?? null,
    sessionParams: result.session ? { ...result.session } : null,
    sessionDisplayId: result.session?.sessionId ?? null
  };
}

/**
 * Picks the default command working directory for model-requested tools.
 *
 * Priority:
 * 1. Explicit adapter `commandCwd`
 * 2. Paperclip workspace cwd from wake context
 * 3. Adapter process cwd as final fallback
 */
export function resolveCommandCwd(
  ctx: AdapterExecutionContext,
  configuredCommandCwd?: string
): string {
  if (configuredCommandCwd) {
    return configuredCommandCwd;
  }

  const workspace = ctx.context.paperclipWorkspace;
  if (typeof workspace === "object" && workspace !== null) {
    const cwd = (workspace as Record<string, unknown>).cwd;
    if (typeof cwd === "string" && cwd.trim() !== "") {
      return cwd;
    }
  }

  return process.cwd();
}

export function buildToolEnv(ctx: AdapterExecutionContext): Record<string, string> {
  return Object.fromEntries([
    ["PAPERCLIP_COMPANY_ID", ctx.agent.companyId],
    ["PAPERCLIP_AGENT_ID", ctx.agent.id],
    ["PAPERCLIP_RUN_ID", ctx.runId],
    ["PAPERCLIP_TASK_ID", readTaskId(ctx)]
  ].filter((entry): entry is [string, string] => {
    return typeof entry[1] === "string" && entry[1].trim() !== "";
  }));
}

function readTaskId(ctx: AdapterExecutionContext): string | undefined {
  const contextTaskId = readContextString(ctx.context, "taskId");
  if (contextTaskId) {
    return contextTaskId;
  }

  return typeof ctx.runtime.taskKey === "string" ? ctx.runtime.taskKey : undefined;
}

function readContextString(context: unknown, key: string): string | undefined {
  if (typeof context !== "object" || context === null) {
    return undefined;
  }

  const value = (context as Record<string, unknown>)[key];
  return typeof value === "string" ? value : undefined;
}

function readCommandCwdSource(
  ctx: AdapterExecutionContext,
  configuredCommandCwd?: string
): "adapterConfig.commandCwd" | "context.paperclipWorkspace.cwd" | "process.cwd" {
  if (configuredCommandCwd) {
    return "adapterConfig.commandCwd";
  }

  const workspace = ctx.context.paperclipWorkspace;
  if (typeof workspace === "object" && workspace !== null) {
    const cwd = (workspace as Record<string, unknown>).cwd;
    if (typeof cwd === "string" && cwd.trim() !== "") {
      return "context.paperclipWorkspace.cwd";
    }
  }

  return "process.cwd";
}

/** Emits structured debug logs only when the adapter logging toggle is enabled. */
async function logDebug(
  ctx: AdapterExecutionContext,
  enabled: boolean | undefined,
  message: string,
  data: Record<string, unknown>
): Promise<void> {
  if (!enabled) {
    return;
  }

  await ctx.onLog("stdout", `[${ADAPTER_TYPE}:debug] ${message}\n${JSON.stringify(data, null, 2)}\n`);
}
