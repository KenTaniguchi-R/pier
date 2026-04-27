import type { Tool, Defaults } from "../domain/tool";
import type { RunStatus, Stream } from "../domain/runRequest";
import type { Action } from "./actions";

export interface RunLine {
  ts: number;
  line: string;
  stream: Stream;
  /** True for `\r`-terminated progress segments. The next segment from the same
   * stream replaces this one, so a tqdm bar collapses to a single mutating row. */
  transient: boolean;
}

export interface RunState {
  toolId: string;
  status: RunStatus;
  exitCode: number | null;
  startedAt: number;
  endedAt: number | null;
  lines: RunLine[];
}

export interface AppState {
  tools: Tool[];
  defaults?: Defaults;
  configErrors: string[];
  runs: Record<string, RunState>;
  selectedRunIdByTool: Record<string, string>;
}

export const initialState: AppState = {
  tools: [],
  defaults: undefined,
  configErrors: [],
  runs: {},
  selectedRunIdByTool: {},
};

export function reducer(s: AppState, a: Action): AppState {
  switch (a.type) {
    case "CONFIG_LOADED":
      return { ...s, tools: a.tools, defaults: a.defaults, configErrors: [] };
    case "CONFIG_ERROR":
      return { ...s, configErrors: a.errors };
    case "RUN_STARTED":
      return {
        ...s,
        selectedRunIdByTool: { ...s.selectedRunIdByTool, [a.toolId]: a.runId },
        runs: {
          ...s.runs,
          [a.runId]: {
            toolId: a.toolId,
            status: "running",
            exitCode: null,
            startedAt: a.startedAt,
            endedAt: null,
            lines: [],
          },
        },
      };
    case "RUN_OUTPUT": {
      const r = s.runs[a.runId];
      if (!r) return s;
      const next: RunLine = {
        ts: Date.now(),
        line: a.line,
        stream: a.stream,
        transient: a.transient,
      };
      // Progress collapsing: when the previous trailing entry is a transient
      // segment from the same stream, the incoming segment supersedes it.
      const last = r.lines[r.lines.length - 1];
      const lines = last && last.transient && last.stream === a.stream
        ? [...r.lines.slice(0, -1), next]
        : [...r.lines, next];
      return { ...s, runs: { ...s.runs, [a.runId]: { ...r, lines } } };
    }
    case "RUN_EXIT": {
      const r = s.runs[a.runId];
      if (!r) return s;
      return {
        ...s,
        runs: {
          ...s.runs,
          [a.runId]: { ...r, status: a.status, exitCode: a.exitCode, endedAt: a.endedAt },
        },
      };
    }
  }
}

/** Plain-text concatenation of a run's output, suitable for clipboard. */
export function runOutputText(r: RunState): string {
  return r.lines.map((l) => l.line).join("\n");
}

export interface RunningEntry {
  runId: string;
  toolId: string;
  startedAt: number;
}

/** All currently-running runs, oldest first. */
export function runningRuns(s: AppState): RunningEntry[] {
  const out: RunningEntry[] = [];
  for (const [runId, r] of Object.entries(s.runs)) {
    if (r.status === "running") {
      out.push({ runId, toolId: r.toolId, startedAt: r.startedAt });
    }
  }
  out.sort((a, b) => a.startedAt - b.startedAt);
  return out;
}

/** Set of toolIds with at least one running run. */
export function runningToolIds(s: AppState): Set<string> {
  const set = new Set<string>();
  for (const r of Object.values(s.runs)) {
    if (r.status === "running") set.add(r.toolId);
  }
  return set;
}
