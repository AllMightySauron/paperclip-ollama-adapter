export const agentConfigurationDoc = `# Local Ollama configuration

Adapter type: \`ollama_local\`

Core fields:
- \`model\` (string, required): Ollama model name, for example \`llama3.2\` or \`qwen2.5-coder\`.
- \`baseUrl\` (string, optional): Ollama server root. Defaults to \`http://127.0.0.1:11434\`.
- \`timeoutSec\` (number, optional): Paperclip's built-in timeout control. The adapter uses this as the Ollama request timeout in seconds. Defaults to \`120\`.
- \`logging\` (boolean, optional): Enables detailed Paperclip logs for prompt rendering, Ollama chat request bodies, raw Ollama replies, parsed results, and failures. Defaults to \`false\`.
- \`enableCommandExecution\` (boolean, optional): Enables trusted local \`run_command\` tool calls from Ollama. Defaults to \`false\`.
- \`commandCwd\` (string, optional): Absolute working directory for model-requested commands. Defaults to Paperclip's working directory when provided, otherwise the adapter process directory.
- \`commandTimeoutSec\` (number, optional): Maximum seconds each model-requested command may run. Defaults to \`120\`.
- \`maxToolCalls\` (number, optional): Maximum number of command tool calls in one run. Defaults to \`8\`.
- \`thinkingEffort\` or \`think\` (true | false | "low" | "medium" | "high", optional): Ollama thinking control. Paperclip's built-in Thinking Effort field is preferred and maps into Ollama's \`think\` request option.
- \`instructions\` (string, optional): System instructions for the agent.
- \`promptTemplate\` (string, optional): Prompt template for Paperclip wake context.

Command execution requires a model that returns native Ollama \`message.tool_calls\` from \`/api/chat\`. Text-only tool-call imitations such as XML-style \`<function_calls>\` blocks are treated as normal assistant text and will not run commands.

Major TODOs before production use:
- Decide what session state should be persisted across heartbeats.
- Add Paperclip API fetches for thin context runs.
- Optionally support streamed responses and forward chunks through Paperclip's \`onLog\`.
`;
