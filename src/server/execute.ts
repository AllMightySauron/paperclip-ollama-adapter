import type {
  AdapterExecutionContext,
  AdapterExecutionResult
} from "@paperclipai/adapter-utils";
import { ADAPTER_TYPE } from "../types.js";
import { parseConfig } from "./config.js";
import { invokeOllama } from "./ollama.js";
import { buildPrompt } from "./prompt.js";
import { parseSession } from "./session.js";

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
    logging: config.logging ?? false,
    enableCommandExecution: config.enableCommandExecution ?? false,
    commandCwd: config.commandCwd ?? null,
    commandTimeoutSec: config.commandTimeoutSec,
    maxToolCalls: config.maxToolCalls,
    hasInstructions: Boolean(config.instructions),
    hasPromptTemplate: Boolean(config.promptTemplate),
    think: config.think ?? null
  });

  const prompt = buildPrompt(ctx, config);
  await logDebug(ctx, config.logging, "Rendered prompt", {
    length: prompt.length,
    prompt
  });

  const result = await invokeOllama({
    baseUrl: config.baseUrl,
    model: config.model,
    prompt,
    timeoutMs: config.timeoutSec * 1000,
    session: parseSession(ctx.runtime.sessionParams),
    runId: ctx.runId,
    onLog: ctx.onLog,
    ...(ctx.onSpawn ? { onSpawn: ctx.onSpawn } : {}),
    commandExecution: {
      enabled: config.enableCommandExecution ?? false,
      cwd: config.commandCwd ?? process.cwd(),
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
