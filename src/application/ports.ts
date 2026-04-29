import type { RunOutcome, RunStatus, Stream } from "../domain/runRequest";

export interface ConfigLoader {
  load(): Promise<{ raw: unknown; pathHint: string }>;
  watch(onChange: () => void): () => void;
}

export interface CommandRunner {
  run(toolId: string, values: Record<string, unknown>, confirmed: boolean): Promise<RunOutcome>;
  kill(runId: string): Promise<void>;
  onOutput(cb: (runId: string, line: string, stream: Stream, transient: boolean) => void): () => void;
  onExit(cb: (runId: string, outcome: RunOutcome) => void): () => void;
}

export interface AuditLogger {
  append(entry: object): Promise<void>;
}

export interface RunSummary {
  runId: string;
  toolId: string;
  /** Epoch milliseconds. Infra adapters convert from backend seconds. */
  startedAt: number;
  /** Epoch milliseconds, or null while running. */
  endedAt: number | null;
  status: RunStatus;
  exitCode: number | null;
  outputPath: string | null;
  outputBytes: number | null;
  outputTruncated: boolean | null;
}

export interface RunLogLine {
  s: "stdout" | "stderr";
  t: string;
  r?: boolean;
}

export interface RecentToolRun {
  toolId: string;
  /** Epoch milliseconds. Adapters convert from backend seconds. */
  lastRunAt: number;
  lastStatus: RunStatus;
}

export interface HistoryReader {
  list(toolId: string, limit?: number): Promise<RunSummary[]>;
  readOutput(outputPath: string): Promise<RunLogLine[]>;
  listRecentTools(limit?: number): Promise<RecentToolRun[]>;
}

export interface DragPosition { x: number; y: number }
export type DragDropEvent =
  | { kind: "over"; position: DragPosition }
  | { kind: "leave" }
  | { kind: "drop"; paths: string[]; position: DragPosition };

export interface UrlOpener {
  /** Open a URL in the user's default browser. Implementations MUST validate
   *  the URL against a scheme allowlist and reject unsafe inputs. */
  open(url: string): Promise<void>;
}

export interface SettingsAdapter {
  load(): Promise<import("../domain/settings").Settings>;
  save(settings: import("../domain/settings").Settings): Promise<void>;
  patch(
    partial: import("../domain/settings").DeepPartial<import("../domain/settings").Settings>,
  ): Promise<import("../domain/settings").Settings>;
  historyStats(): Promise<import("../domain/settings").HistoryStats>;
  clearHistory(): Promise<void>;
}

export interface FilePicker {
  /** Subscribe to native drag-drop events from the host webview. */
  onDragDrop(cb: (e: DragDropEvent) => void): () => void;
  /** Open a native file picker. Returns absolute path or null if cancelled. */
  pick(opts: { directory?: boolean; accepts?: string[] }): Promise<string | null>;
}

import type { UpdateInfo, UpdateProgress } from "../domain/update";

export interface UpdateChecker {
  check(): Promise<UpdateInfo | null>;
  installAndRelaunch(onProgress: (p: UpdateProgress) => void): Promise<void>;
  isTranslocated(): Promise<boolean>;
  setTrayBadge(hasUpdate: boolean): void;
  notifyReady(version: string): void;
  /** Subscribe to changes in the main window's visibility (true = visible). */
  onWindowVisibilityChange(cb: (visible: boolean) => void): () => void;
  isWindowVisible(): Promise<boolean>;
}

import type { Catalog, CatalogTool } from "../domain/library";

export interface LibraryAddPreview {
  before: string;
  after: string;
  newTool: import("../domain/tool").Tool;
}

export interface LibraryClient {
  fetchCatalog(): Promise<Catalog>;
  installAndPreview(tool: CatalogTool): Promise<LibraryAddPreview>;
  commitAdd(after: string): Promise<void>;
}
