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

Use run_command only when you need local workspace information or need to run a script. The tool accepts exactly one executable in "command" and that executable's arguments in "args".

Correct examples:
- Read a file: command="cat", args=["path/to/file.md"]
- List a directory: command="ls", args=["path/to/dir"]
- Recursively list a directory: command="ls", args=["-R", "path/to/dir"]
- Run tests: command="npm", args=["test"]

Incorrect examples:
- command="ls", args=["cat", "file.md"]
- command="ls", args=["ls-R"]
- command="cat file.md", args=[]
- command="npm test", args=[]

Do not combine multiple commands in one call. Do not put another command name in args. Do not concatenate the command and option; use args=["-R"], not args=["ls-R"]. Do not use shell operators unless you intentionally run a shell executable such as command="sh", args=["-lc", "..."].`;
}
