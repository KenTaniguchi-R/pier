import type { Tool, Defaults } from "../domain/tool";
import type { RunStatus, Stream } from "../domain/runRequest";

export type Action =
  | { type: "CONFIG_LOADED"; tools: Tool[]; defaults?: Defaults }
  | { type: "CONFIG_ERROR"; errors: string[] }
  | { type: "RUN_STARTED"; runId: string; toolId: string; startedAt: number }
  | { type: "RUN_OUTPUT"; runId: string; line: string; stream: Stream; transient: boolean }
  | { type: "RUN_EXIT"; runId: string; status: RunStatus; exitCode: number | null; endedAt: number };
