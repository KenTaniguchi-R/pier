import type { Tool } from "../domain/tool";
import type { RunOutcome, RunRequest } from "../domain/runRequest";

export interface ConfigLoader {
  load(): Promise<{ raw: unknown; pathHint: string }>;
  watch(onChange: () => void): () => void;
}

export interface CommandRunner {
  run(req: RunRequest, tool: Tool): Promise<RunOutcome>;
  kill(runId: string): Promise<void>;
  onOutput(cb: (runId: string, line: string, stream: "stdout" | "stderr") => void): () => void;
  onExit(cb: (runId: string, outcome: RunOutcome) => void): () => void;
}

export interface AuditLogger {
  append(entry: object): Promise<void>;
}
