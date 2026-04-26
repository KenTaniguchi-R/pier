export type RunStatus = "pending" | "running" | "success" | "failed" | "killed";

export interface RunRequest {
  toolId: string;
  input: string | null;
}

export interface RunOutcome {
  runId: string;
  status: RunStatus;
  exitCode: number | null;
  startedAt: number;
  endedAt: number | null;
  outputFiles: string[];
}
