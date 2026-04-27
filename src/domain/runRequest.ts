import type { ParamValue } from "./tool";

export type RunStatus = "pending" | "running" | "success" | "failed" | "killed";

export type Stream = "stdout" | "stderr";

export interface RunRequest {
  toolId: string;
  values: Record<string, ParamValue>;
}

export interface RunOutcome {
  runId: string;
  status: RunStatus;
  exitCode: number | null;
  /** Epoch milliseconds (matches Date.now()). */
  startedAt: number;
  /** Epoch milliseconds, or null while running. */
  endedAt: number | null;
  outputFiles: string[];
}
