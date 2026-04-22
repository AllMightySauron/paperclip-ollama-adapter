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
  const rendered = renderTemplate(template, {
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

  if (!config.enableCommandExecution) {
    return rendered;
  }

  return `${rendered}

Command execution is enabled through the run_command tool.

Use run_command only when you need local workspace information or need to run a script.
The "command" value must be exactly one executable. The "args" array must contain only that executable's arguments.

Examples:
- Read a file: command="cat", args=["path/to/file.md"]
- List recursively: command="ls", args=["-R", "path/to/dir"]
- Run tests: command="npm", args=["test"]

Do not combine commands. Do not write command="npm test" or args=["ls-R"]. Use args=["-R"] instead.`;
}
