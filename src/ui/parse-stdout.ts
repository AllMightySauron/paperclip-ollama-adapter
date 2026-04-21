export interface TranscriptEntry {
  stream: "stdout" | "stderr";
  text: string;
  timestamp?: string;
  meta?: Record<string, unknown>;
}

export function parseStdoutForTranscript(stdout: string): TranscriptEntry[] {
  // TODO: Parse structured Ollama/Paperclip log lines into richer transcript
  // entries once the execution layer emits stable JSON log events.
  return stdout
    .split(/\r?\n/)
    .filter((line) => line.length > 0)
    .map((line) => ({
      stream: "stdout" as const,
      text: line
    }));
}
