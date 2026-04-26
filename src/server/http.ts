import { Agent } from "undici";

export function buildOllamaFetchInit(
  timeoutMs: number,
  init: RequestInit
): RequestInit {
  return {
    ...init,
    dispatcher: new Agent({
      headersTimeout: timeoutMs,
      bodyTimeout: timeoutMs
    })
  } as RequestInit;
}
