import { invoke } from "@tauri-apps/api/core";
import type { HistoryReader, RecentToolRun, RunLogLine, RunSummary } from "../application/ports";

// Backend audit log stores epoch seconds; the React app uses ms.
const toMs = (r: RunSummary): RunSummary => ({
  ...r,
  startedAt: r.startedAt * 1000,
  endedAt: r.endedAt != null ? r.endedAt * 1000 : null,
});

interface RawRecentToolRun {
  toolId: string;
  lastRunAt: number;
  lastStatus: RecentToolRun["lastStatus"];
}

export const tauriHistoryReader: HistoryReader = {
  async list(toolId, limit) {
    const rows = await invoke<RunSummary[]>("list_tool_history", { toolId, limit });
    return rows.map(toMs);
  },
  async readOutput(outputPath) {
    return invoke<RunLogLine[]>("read_run_output", { outputPath });
  },
  async listRecentTools(limit) {
    const rows = await invoke<RawRecentToolRun[]>("list_recent_tools_cmd", { limit });
    return rows.map((r) => ({ ...r, lastRunAt: r.lastRunAt * 1000 }));
  },
};
