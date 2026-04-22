export const agentConfigurationDoc = `# Local Ollama configuration

Adapter type: \`ollama_local\`

Core fields:
- \`model\` (string, required): Ollama model name, for example \`llama3.2\` or \`qwen2.5-coder\`.
- \`baseUrl\` (string, optional): Ollama server root. Defaults to \`http://127.0.0.1:11434\`.
- \`timeoutSec\` (number, optional): Paperclip's built-in timeout control. The adapter uses this as the Ollama request timeout in seconds. Defaults to \`120\`.
- \`logging\` (boolean, optional): Enables detailed Paperclip logs for prompt rendering, Ollama chat request bodies, raw Ollama replies, parsed results, and failures. Defaults to \`false\`.
- \`thinkingEffort\` or \`think\` (true | false | "low" | "medium" | "high", optional): Ollama thinking control. Paperclip's built-in Thinking Effort field is preferred and maps into Ollama's \`think\` request option.
- \`instructions\` (string, optional): System instructions for the agent.
- \`promptTemplate\` (string, optional): Prompt template for Paperclip wake context.

Major TODOs before production use:
- Decide what session state should be persisted across heartbeats.
- Add Paperclip API fetches for thin context runs.
- Optionally support streamed responses and forward chunks through Paperclip's \`onLog\`.
`;
