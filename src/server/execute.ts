import type {
  AdapterExecutionContext,
  AdapterExecutionResult
} from "@paperclipai/adapter-utils";
import { ADAPTER_TYPE } from "../types.js";
import { parseConfig } from "./config.js";
import { invokeOllama } from "./ollama.js";
import { buildPrompt } from "./prompt.js";
import { parseSession } from "./session.js";

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

  const prompt = buildPrompt(ctx, config);
  const result = await invokeOllama({
    baseUrl: config.baseUrl,
    model: config.model,
    prompt,
    timeoutMs: config.timeoutSec * 1000,
    session: parseSession(ctx.runtime.sessionParams),
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
