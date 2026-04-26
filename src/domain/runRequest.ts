import type { ParamValue } from "./tool";

export type RunStatus = "pending" | "running" | "success" | "failed" | "killed";

export interface RunRequest {
  toolId: string;
  values: Record<string, ParamValue>;
}

export interface RunOutcome {
  runId: string;
  status: RunStatus;
  exitCode: number | null;
  startedAt: number;
  endedAt: number | null;
  outputFiles: string[];
}
