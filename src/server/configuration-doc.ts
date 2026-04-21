export const agentConfigurationDoc = `# Local Ollama configuration

Adapter type: \`ollama_local\`

Core fields:
- \`model\` (string, required): Ollama model name, for example \`llama3.2\` or \`qwen2.5-coder\`.
- \`baseUrl\` (string, optional): Ollama server root. Defaults to \`http://127.0.0.1:11434\`.
- \`timeoutSec\` (number, optional): Request timeout in seconds. Defaults to \`120\`.
- \`think\` (true | false | "low" | "medium" | "high", optional): Ollama thinking control. Most thinking models accept booleans. GPT-OSS expects one of \`"low"\`, \`"medium"\`, or \`"high"\`.
- \`instructions\` (string, optional): System instructions for the agent.
- \`promptTemplate\` (string, optional): Prompt template for Paperclip wake context.

Major TODOs before production use:
- Decide what session state should be persisted across heartbeats.
- Add Paperclip API fetches for thin context runs.
- Optionally support streamed responses and forward chunks through Paperclip's \`onLog\`.
`;
