import {
  ensureAbsoluteDirectory,
  runChildProcess
} from "@paperclipai/adapter-utils/server-utils";
import type {
  OllamaLogFn,
  OllamaSpawnFn
} from "../types.js";

export interface RunCommandInput {
  command: string;
  args?: string[];
  cwd?: string;
  stdin?: string;
}

export interface RunCommandOptions {
  runId: string;
  defaultCwd: string;
  timeoutSec: number;
  onLog: OllamaLogFn;
  onSpawn?: OllamaSpawnFn;
}

export interface RunCommandOutput {
  command: string;
  args: string[];
  cwd: string;
  exitCode: number | null;
  signal: string | null;
  timedOut: boolean;
  stdout: string;
  stderr: string;
}

export async function runTrustedCommand(
  input: RunCommandInput,
  options: RunCommandOptions
): Promise<RunCommandOutput> {
  const command = input.command.trim();
  if (!command) {
    throw new Error("run_command requires a non-empty command");
  }

  const args = normalizeArgs(input.args, command);
  const cwd = input.cwd?.trim() || options.defaultCwd;

  await ensureAbsoluteDirectory(cwd);
  await options.onLog("stdout", `[ollama:tool] run_command ${formatCommand(command, args)}\n`);

  const result = await runChildProcess(options.runId, command, args, {
    cwd,
    env: readProcessEnv(),
    timeoutSec: options.timeoutSec,
    graceSec: 5,
    onLog: options.onLog,
    ...(options.onSpawn ? { onSpawn: options.onSpawn } : {}),
    ...(input.stdin ? { stdin: input.stdin } : {})
  });

  return {
    command,
    args,
    cwd,
    exitCode: result.exitCode,
    signal: result.signal,
    timedOut: result.timedOut,
    stdout: result.stdout,
    stderr: result.stderr
  };
}

export function parseRunCommandInput(value: unknown): RunCommandInput {
  if (typeof value !== "object" || value === null) {
    throw new Error("run_command arguments must be an object");
  }

  const record = value as Record<string, unknown>;
  if (typeof record.command !== "string") {
    throw new Error("run_command.command must be a string");
  }

  return {
    command: record.command,
    ...(Array.isArray(record.args) ? { args: normalizeArgs(record.args, record.command) } : {}),
    ...(typeof record.cwd === "string" ? { cwd: record.cwd } : {}),
    ...(typeof record.stdin === "string" ? { stdin: record.stdin } : {})
  };
}

function normalizeArgs(value: unknown, command: string): string[] {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new Error("run_command.args must be an array of strings");
  }
  return value.map((arg, index) => {
    if (typeof arg !== "string") {
      throw new Error("run_command.args must be an array of strings");
    }
    return normalizeArgArtifact(arg, index, command);
  });
}

function normalizeArgArtifact(arg: string, index: number, command: string): string {
  const cleaned = arg
    .replaceAll("<|\"|", "")
    .replaceAll("<|'|", "")
    .replaceAll("<|", "")
    .replaceAll("|>", "")
    .replaceAll("\"", "")
    .trim();

  if (index !== 0) {
    return cleaned;
  }

  const trimmedCommand = command.trim();
  if (!trimmedCommand || !cleaned.startsWith(trimmedCommand)) {
    return cleaned;
  }

  const remainder = cleaned.slice(trimmedCommand.length);
  if (remainder.startsWith("-")) {
    return remainder;
  }

  return cleaned;
}

function readProcessEnv(): Record<string, string> {
  return Object.fromEntries(
    Object.entries(process.env).filter((entry): entry is [string, string] => {
      return typeof entry[1] === "string";
    })
  );
}

function formatCommand(command: string, args: string[]): string {
  return [command, ...args].join(" ");
}
