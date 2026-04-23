export const agentConfigurationDoc = `# Local Ollama configuration

Adapter type: \`ollama_local\`

Model dropdown:
- The dropdown is populated by the adapter's \`listModels()\` hook.
- \`Test environment\` queries \`GET /api/tags\` with the configured \`baseUrl\` and stores the latest successful result in process memory.
- \`listModels()\` returns that cached result first. Without a cache, it queries \`GET /api/tags\` using \`OLLAMA_BASE_URL\` when set, otherwise \`http://127.0.0.1:11434\`.
- If live discovery fails, the adapter returns a fallback list so the UI can still render.
- Paperclip's current \`listModels()\` hook does not pass the per-agent \`baseUrl\` config value, so the cache is process-local and last-writer-wins.

Core fields:
- \`model\` (string, required): Ollama model name, for example \`llama3.2\` or \`qwen2.5-coder\`.
- \`baseUrl\` (string, optional): Ollama server root. Defaults to \`OLLAMA_BASE_URL\` when set, otherwise \`http://127.0.0.1:11434\`.
- \`timeoutSec\` (number, optional): Paperclip's built-in timeout control. The adapter uses this as the Ollama request timeout in seconds. Defaults to \`120\`.
- \`logging\` (boolean, optional): Enables detailed Paperclip logs for prompt rendering, Ollama chat request bodies, raw Ollama replies, parsed results, and failures. Defaults to \`false\`.
- \`think\` (false | "low" | "medium" | "high", optional): Adapter-specific thinking control. Use \`false\` to disable thinking. When set, this overrides Paperclip's built-in \`thinkingEffort\` value.
- \`enableCommandExecution\` (boolean, optional): Enables trusted local \`run_command\` tool calls from Ollama. Defaults to \`false\`.
- \`commandCwd\` (string, optional): Absolute working directory for model-requested commands. Defaults to \`context.paperclipWorkspace.cwd\` from the Paperclip project workspace when available, otherwise the adapter process directory.
- \`commandTimeoutSec\` (number, optional): Maximum seconds each model-requested command may run. Defaults to \`120\`.
- \`maxToolCalls\` (number, optional): Maximum number of command tool calls in one run. Defaults to \`8\`.
- \`thinkingEffort\` (true | false | "low" | "medium" | "high", optional): Fallback for Paperclip's built-in Thinking Effort field. The adapter's own \`think\` field is preferred because it exposes an explicit Off option in the UI.
- \`instructions\` (string, optional): System instructions for the agent.
- \`promptTemplate\` (string, optional): Prompt template for Paperclip wake context.

Command execution requires a model that returns native Ollama \`message.tool_calls\` from \`/api/chat\`. Text-only tool-call imitations such as XML-style \`<function_calls>\` blocks are treated as normal assistant text and will not run commands.

Major TODOs before production use:
- Decide what session state should be persisted across heartbeats.
- Add Paperclip API fetches for thin context runs.
- Optionally support streamed responses and forward chunks through Paperclip's \`onLog\`.
`;
