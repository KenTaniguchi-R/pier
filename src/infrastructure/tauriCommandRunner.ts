import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { CommandRunner } from "../application/ports";
import type { RunStatus, Stream } from "../domain/runRequest";

interface ExitPayload { runId: string; status: RunStatus; exitCode: number | null; endedAt: number }
interface OutputPayload { runId: string; line: string; stream: Stream; transient: boolean }

// Backend timestamps are epoch seconds; the React app uses ms (Date.now()).
// Convert at this boundary so no caller has to think about units.
const secsToMs = (s: number) => s * 1000;

export const tauriCommandRunner: CommandRunner = {
  async run(toolId, values, confirmed) {
    const runId = await invoke<string>("run_tool_cmd", {
      payload: { toolId, values, confirmed },
    });
    return {
      runId,
      status: "running",
      exitCode: null,
      startedAt: Date.now(),
      endedAt: null,
      outputFiles: [],
    };
  },

  async kill(runId) {
    await invoke("kill_run_cmd", { runId });
  },

  onOutput(cb) {
    const unlistenP = listen<OutputPayload>("pier://output", e => {
      cb(e.payload.runId, e.payload.line, e.payload.stream, e.payload.transient);
    });
    return () => { unlistenP.then(fn => fn()).catch(() => {}); };
  },

  onExit(cb) {
    const unlistenP = listen<ExitPayload>("pier://exit", e => {
      cb(e.payload.runId, {
        runId: e.payload.runId,
        status: e.payload.status,
        exitCode: e.payload.exitCode,
        startedAt: 0,
        endedAt: secsToMs(e.payload.endedAt),
        outputFiles: [],
      });
    });
    return () => { unlistenP.then(fn => fn()).catch(() => {}); };
  },
};
