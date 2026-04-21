import type { AdapterExecutionContext } from "@paperclipai/adapter-utils";
import { renderTemplate } from "@paperclipai/adapter-utils/server-utils";
import type { OllamaAdapterConfig } from "../types.js";

const DEFAULT_PROMPT_TEMPLATE = `You are {{agent.name}}, a Paperclip agent.

Wake context:
{{contextJson}}

Continue the highest-priority work that is appropriate for this heartbeat.`;

export function buildPrompt(
  ctx: AdapterExecutionContext,
  config: OllamaAdapterConfig
): string {
  const template = config.promptTemplate ?? DEFAULT_PROMPT_TEMPLATE;
  return renderTemplate(template, {
    agent: ctx.agent,
    company: {
      id: ctx.agent.companyId
    },
    run: {
      id: ctx.runId
    },
    context: ctx.context,
    contextJson: JSON.stringify(ctx.context, null, 2)
  });
}
