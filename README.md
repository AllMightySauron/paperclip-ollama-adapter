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
| `think` | No | Model thinking level (high, low, false) |
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

## Major TODOs

- Decide which session metadata should persist in `sessionParams`.
- Fill in UI config fields when Paperclip's external adapter UI API is finalized.
- Fill in CLI event formatting once execution emits stable structured events.
- Optionally support streamed Ollama responses and forward chunks to `ctx.onLog`.

## License

Apache 2.0
