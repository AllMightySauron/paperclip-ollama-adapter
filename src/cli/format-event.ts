export interface AdapterRunEvent {
  stream?: "stdout" | "stderr";
  message?: string;
  chunk?: string;
  [key: string]: unknown;
}

export function formatRunEvent(event: AdapterRunEvent): string {
  // TODO: Add Ollama-specific terminal formatting for `paperclipai run --watch`.
  const text = event.message ?? event.chunk ?? JSON.stringify(event);
  return event.stream === "stderr" ? `[ollama:error] ${text}` : `[ollama] ${text}`;
}
