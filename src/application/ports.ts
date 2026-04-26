import type { Tool, Defaults } from "../domain/tool";
import type { RunOutcome, RunRequest } from "../domain/runRequest";

export interface ConfigLoader {
  load(): Promise<{ raw: unknown; pathHint: string }>;
  watch(onChange: () => void): () => void;
}

export interface CommandRunner {
  run(req: RunRequest, tool: Tool, defaults?: Defaults): Promise<RunOutcome>;
  kill(runId: string): Promise<void>;
  onOutput(cb: (runId: string, line: string, stream: "stdout" | "stderr") => void): () => void;
  onExit(cb: (runId: string, outcome: RunOutcome) => void): () => void;
}

export interface AuditLogger {
  append(entry: object): Promise<void>;
}

export interface DragPosition { x: number; y: number }
export type DragDropEvent =
  | { kind: "over"; position: DragPosition }
  | { kind: "leave" }
  | { kind: "drop"; paths: string[]; position: DragPosition };

export interface FilePicker {
  /** Subscribe to native drag-drop events from the host webview. */
  onDragDrop(cb: (e: DragDropEvent) => void): () => void;
  /** Open a native file picker. Returns absolute path or null if cancelled. */
  pick(opts: { directory?: boolean; accepts?: string[] }): Promise<string | null>;
}
