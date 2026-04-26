import type { Tool, Defaults } from "../domain/tool";
import type { RunStatus } from "../domain/runRequest";
import type { Action } from "./actions";

export interface RunState {
  toolId: string;
  status: RunStatus;
  exitCode: number | null;
  startedAt: number;
  endedAt: number | null;
  lines: { ts: number; line: string; stream: "stdout" | "stderr" }[];
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
      return {
        ...s,
        runs: {
          ...s.runs,
          [a.runId]: {
            ...r,
            lines: [...r.lines, { ts: Date.now(), line: a.line, stream: a.stream }],
          },
        },
      };
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
