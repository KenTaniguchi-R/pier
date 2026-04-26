import type { Tool } from "../domain/tool";
import type { RunStatus } from "../domain/runRequest";

export type Action =
  | { type: "CONFIG_LOADED"; tools: Tool[] }
  | { type: "CONFIG_ERROR"; errors: string[] }
  | { type: "RUN_STARTED"; runId: string; toolId: string; startedAt: number }
  | { type: "RUN_OUTPUT"; runId: string; line: string; stream: "stdout" | "stderr" }
  | { type: "RUN_EXIT"; runId: string; status: RunStatus; exitCode: number | null; endedAt: number }
  | { type: "SELECT_RUN"; runId: string | null };
