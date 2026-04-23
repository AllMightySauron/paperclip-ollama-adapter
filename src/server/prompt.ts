import type { AdapterExecutionContext } from "@paperclipai/adapter-utils";
import { renderTemplate } from "@paperclipai/adapter-utils/server-utils";
import type { OllamaAdapterConfig } from "../types.js";

const DEFAULT_PROMPT_TEMPLATE = `You are {{agent.name}}, a Paperclip agent.

Wake context:
{{contextJson}}

Continue the highest-priority work that is appropriate for this heartbeat.`;

/**
 * Renders the Paperclip wake context into the prompt sent to Ollama.
 *
 * The template helper comes from Paperclip adapter utils so custom prompt
 * templates use the same placeholder behavior as other external adapters.
 */
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

  // Keep this guidance compact: detailed enough to steer tool calls, but not so
  // verbose that Ollama-hosted models reject the request or degrade schema use.
  return `${rendered}

Command execution is enabled through the run_command tool.

Use run_command only when you need local workspace information or need to run a script.
The "command" value must be exactly one executable. The "args" array must contain only that executable's arguments.
If you need shell syntax such as redirects, pipes, or &&, use command="sh" and args=["-lc", "..."].

Examples:
- Read a file: command="cat", args=["path/to/file.md"]
- List recursively: command="ls", args=["-R", "path/to/dir"]
- Find while suppressing errors: command="sh", args=["-lc", "find /paperclip -name 'file.md' 2>/dev/null"]
- Run tests: command="npm", args=["test"]

Do not write args=["ls-R"]. Use args=["-R"] instead.`;
}
