import type { AdapterModel } from "@paperclipai/adapter-utils";

/** Safe fallback list used when live Ollama model discovery is unavailable. */
export const fallbackModels: AdapterModel[] = [
  { id: "llama3.2", label: "Llama 3.2" },
  { id: "qwen2.5-coder", label: "Qwen 2.5 Coder" },
  { id: "deepseek-r1", label: "DeepSeek R1" }
];

/** Converts Ollama model ids into Paperclip dropdown options. */
export function toAdapterModels(modelIds: string[]): AdapterModel[] {
  return modelIds.map((id) => ({ id, label: id }));
}
