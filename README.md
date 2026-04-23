# paperclip-ollama-adapter

A [Paperclip](https://github.com/paperclipai/paperclip) adapter that connects agents to a local Ollama server.

## Installation

Install via Paperclip's **Adapter Plugin Manager** (Settings > Adapters > External):

```
paperclip-ollama-adapter
```

Or add to `~/.paperclip/adapter-plugins.json` once this package is published or linked:

```json
[{ "package": "paperclip-ollama-adapter" }]
```

## Development

```bash
npm install
npm run check
npm test
npm run build
```

The public package entrypoint exports the adapter as both a named and default export:

```ts
import { ollamaAdapter } from "paperclip-ollama-adapter";
```

The server-only module is available at:

```ts
import { ollamaAdapter } from "paperclip-ollama-adapter/server";
```

## Agent Configuration

When creating or editing an agent, select **Local Ollama** as the adapter type and fill in:

| Field | Required | Description |
|---|---|---|
| `model` | Yes | Model ID from Paperclip's built-in model selector. Free-form Ollama names may be entered if the UI allows custom model values. |
| `baseUrl` | No | API endpoint root (default: http://127.0.0.1:11434) |
| `timeoutSec` | No | Paperclip's built-in timeout control. The adapter uses this as the Ollama request timeout in seconds. |
| `logging` | No | Enables detailed logs for prompt rendering, Ollama `/api/chat` request bodies, raw replies, parsed results, and errors. Defaults to `false`; logs may include sensitive prompt/context data. |
| `enableCommandExecution` | No | Enables trusted local command execution through Ollama tool calls. Defaults to `false`. |
| `commandCwd` | No | Absolute working directory for model-requested commands. Defaults to Paperclip's working directory when provided, otherwise the adapter process directory. |
| `commandTimeoutSec` | No | Maximum seconds each model-requested command may run (default: 120). |
| `maxToolCalls` | No | Maximum number of command tool calls allowed in one run (default: 8). |
| `thinkingEffort` | No | Paperclip's built-in thinking effort control. The adapter maps `low`, `medium`, `high`, `true`, or `false` into Ollama's `think` request option. |
| `instructions` | No | System prompt: the agent's role, persona, and rules |
| `promptTemplate` | No | Template used to turn Paperclip wake context into the Ollama prompt |

Note: The model dropdown on the UI comes from the adapter's `listModels()` hook. The adapter tries to populate it from `GET /api/tags` using the last successful **Test environment** result first, then `OLLAMA_BASE_URL` when set, otherwise `http://127.0.0.1:11434`. If discovery fails, Paperclip still receives a small fallback list so the configuration screen can load.

Paperclip's current adapter hook does not pass the agent's `baseUrl` field into `listModels()`, so the adapter stores the most recent successful `/api/tags` result in process memory when **Test environment** runs. This is process-local and last-writer-wins; restart the Paperclip process or rerun **Test environment** after changing Ollama servers.

Example:

```json
{
  "adapterType": "ollama_local",
  "adapterConfig": {
    "model": "llama3.2",
    "baseUrl": "http://127.0.0.1:11434",
    "timeoutSec": 120,
    "logging": false,
    "enableCommandExecution": false,
    "instructions": "You are a pragmatic Paperclip agent."
  }
}
```

Prompt template example:

```json
{
  "promptTemplate": "You are {{agent.name}} working for company {{company.id}}.\n\nRun ID: {{run.id}}\n\nWake context:\n{{contextJson}}\n\nReview the context, identify the next useful action, and respond with a concise execution plan."
}
```

Supported template variables include `{{agent.id}}`, `{{agent.name}}`, `{{company.id}}`, `{{run.id}}`, `{{contextJson}}`, and dotted paths into the wake context such as `{{context.issue.title}}`.

## Command Execution

When `enableCommandExecution` is enabled, the adapter exposes a trusted local `run_command` tool to Ollama. The model can request commands in direct executable-plus-args form:

```json
{
  "command": "npm",
  "args": ["test"],
  "cwd": "/absolute/path/to/project"
}
```

Commands are run with Paperclip's child process helper, so stdout and stderr stream into the run logs. This intentionally does not evaluate shell strings; shell operators such as `&&`, pipes, redirects, and command substitution are not interpreted unless you explicitly run a shell executable yourself, for example `sh` with `["-lc", "..."]`.

Command execution requires a model that supports native Ollama tool calling and returns `message.tool_calls` from `/api/chat`. Models that emit tool calls only as plain text, XML-like `<function_calls>` blocks, or markdown snippets will not trigger command execution.

Known working model families for tool execution include:

- Gemma family models. `gemma4` is known to work.
- DeepSeek reasoning family models. `deepseek-r1` is known to work.

Some models in the broader DeepSeek family may imitate tool calls in plain text instead of returning native Ollama `message.tool_calls`; those models will not execute commands through this adapter.

This is a trusted local agent capability. Enable it only when the Ollama model is allowed to run scripts and modify files on the Paperclip host.

## Session Persistence

The adapter persists only lightweight continuity metadata in `sessionParams`:

```json
{
  "sessionId": "ollama:llama3.2:2026-04-21T18:00:00.000Z",
  "model": "llama3.2",
  "createdAt": "2026-04-21T18:00:00.000Z",
  "updatedAt": "2026-04-21T18:05:00.000Z",
  "metadata": {
    "endpoint": "http://127.0.0.1:11434/api/chat",
    "lastCreatedAt": "2026-04-21T18:05:00Z",
    "doneReason": "stop"
  }
}
```

Run telemetry such as token counts and durations stays in the run result, not in `sessionParams`. Model output history is not persisted unless conversation memory is added later as an explicit bounded feature.

## Major TODOs

- Fill in CLI event formatting once execution emits stable structured events.
- Optionally support streamed Ollama responses and forward chunks to `ctx.onLog`.

## License

Apache 2.0
