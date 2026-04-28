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
| `baseUrl` | No | API endpoint root. Defaults to `OLLAMA_BASE_URL` when set, otherwise `http://127.0.0.1:11434`. |
| `timeoutSec` | No | Paperclip's built-in run timeout control. |
| `ollamaTimeoutSec` | No | HTTP timeout for each Ollama `/api/chat` call, including skill classification and generation. Defaults to 60 seconds; increase this for long non-streaming generations. |
| `logging` | No | Enables detailed logs for prompt rendering, Ollama `/api/chat` request bodies, raw replies, parsed results, and errors. Defaults to `false`; logs may include sensitive prompt/context data. |
| `streaming` | No | Requests streamed Ollama responses, forwards content chunks to run logs, and aggregates chunks locally. Defaults to `true`; disable this for Ollama-compatible endpoints with broken streaming support. |
| `enableCommandExecution` | No | Enables trusted local command execution through Ollama tool calls. Defaults to `false`. |
| `commandCwd` | No | Absolute working directory for model-requested commands. Defaults to `context.paperclipWorkspace.cwd` from the Paperclip project workspace when available, otherwise the adapter process directory. |
| `commandTimeoutSec` | No | Maximum seconds each model-requested command may run (default: 120). |
| `maxToolCalls` | No | Maximum number of command tool calls allowed in one run (default: 8). |
| `think` | No | Adapter-specific thinking control. Use `Off` to send `think=false` to Ollama. When set, this overrides Paperclip's built-in `thinkingEffort` value. |
| `thinkingEffort` | No | Paperclip's built-in thinking effort control. Still supported as a fallback, but the adapter's own `Thinking` field is preferred because it exposes `Off`. |
| `skillSelectionMode` | No | Controls how Paperclip-managed skills are expanded into full prompt instructions. `deterministic` uses local name/description matching. `llm` asks Ollama to classify relevant skills first and falls back to deterministic matching if classification fails. Defaults to `deterministic`. |
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

## Skills

The adapter implements Paperclip-managed skill sync through `listSkills` and `syncSkills`. Skills selected in the Paperclip UI are read from Paperclip's runtime skill entries and injected into the Ollama prompt under `Available skills`.

Ollama does not have a native local skill directory, so this adapter uses ephemeral prompt injection instead of writing skill files into the project workspace. With `skillSelectionMode: "deterministic"`, required skills are expanded using local name/description matching. With `skillSelectionMode: "llm"`, the adapter asks the configured Ollama model to classify the wake context against selected skill names and descriptions before the main request; if classification fails, it falls back to deterministic matching. Explicitly selected skills are always included in full.

## Command Execution

When `enableCommandExecution` is enabled, the adapter exposes a trusted local `run_command` tool to Ollama. The model can request commands in direct executable-plus-args form:

```json
{
  "command": "npm",
  "args": ["test"],
  "cwd": "/absolute/path/to/project"
}
```

Commands are run with Paperclip's child process helper, so stdout and stderr stream into the run logs. Direct executable-plus-args form is preferred. For trusted local agents, the adapter also detects shell-only syntax such as `&&`, pipes, redirects, command substitution, and full command strings with spaces, then runs that command through `sh -lc`.

For example, this model-emitted command:

```json
{
  "command": "find /paperclip -name \"hiring_plan.md\" 2>/dev/null"
}
```

is normalized to:

```json
{
  "command": "sh",
  "args": ["-lc", "find /paperclip -name \"hiring_plan.md\" 2>/dev/null"]
}
```

Command execution requires a model that supports native Ollama tool calling and returns `message.tool_calls` from `/api/chat`. Models that emit tool calls only as plain text, XML-like `<function_calls>` blocks, or markdown snippets will not trigger command execution.

Known working model families for tool execution include:

- Gemma family models. `gemma4` is known to work.
- Qwen family models. `qwen-3.5` and `qwen3.6` are known to work.
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

Run telemetry such as token counts, durations, and generation speed stays in the run result, not in `sessionParams`. On successful runs with Ollama timing data, stdout includes a line like:

```text
[ollama] generation_speed 128 output tokens in 4.20s = 30.48 tokens/s
```

The same values are also included in `resultJson.generation` as `outputTokens`, `evalDurationMs`, and `tokensPerSecond`. Model output history is not persisted unless conversation memory is added later as an explicit bounded feature.

## Major TODOs

- Fill in CLI event formatting once execution emits stable structured events.
- Add richer structured CLI event formatting.

## License

Apache 2.0
