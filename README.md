# paperclip-ollama-adapter

A [Paperclip](https://github.com/paperclipai/paperclip) adapter that connects agents to a local Ollama server.

This repository is currently a TypeScript scaffold. It implements the adapter shape described in Paperclip's adapter guide and leaves the major runtime behavior as explicit TODO placeholders.

## What is scaffolded

- `ServerAdapterModule` export for Paperclip server registration.
- `execute(ctx)` flow with config validation, logging, prompt construction, session restoration, and structured `AdapterExecutionResult` output.
- `testEnvironment(ctx)` diagnostics with placeholder model discovery.
- `sessionCodec` for heartbeat session persistence.
- Shared adapter metadata and a best-effort Paperclip package manifest.
- UI helper placeholders for building config and parsing run output.
- CLI helper placeholder for formatting live run events.
- Vitest tests covering config errors and defaults.

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
| `model` | Yes | Model ID as the provider lists it (e.g. `qwen-plus`, `deepseek-chat`, `llama3`) |
| `baseUrl` | No | API endpoint root (default: http://127.0.0.1:11434) |
| `timeoutSec` | No | Request timeout in seconds (default: 120) |
| `think` | No | Ollama thinking control: `true`, `false`, `"low"`, `"medium"`, or `"high"`. Most thinking models accept booleans; GPT-OSS expects a level. |
| `instructions` | No | System prompt: the agent's role, persona, and rules |
| `promptTemplate` | No | Template used to turn Paperclip wake context into the Ollama prompt |

Example:

```json
{
  "adapterType": "ollama_local",
  "adapterConfig": {
    "model": "llama3.2",
    "baseUrl": "http://127.0.0.1:11434",
    "timeoutSec": 120,
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

## Major TODOs

- Fill in UI config fields when Paperclip's external adapter UI API is finalized.
- Fill in CLI event formatting once execution emits stable structured events.
- Optionally support streamed Ollama responses and forward chunks to `ctx.onLog`.

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

## License

Apache 2.0
