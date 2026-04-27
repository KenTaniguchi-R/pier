import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { CommandRunner } from "../application/ports";
import type { RunOutcome, RunStatus, Stream } from "../domain/runRequest";

interface ExitPayload { runId: string; status: RunStatus; exitCode: number | null; endedAt: number }
interface OutputPayload { runId: string; line: string; stream: Stream; transient: boolean }

export const tauriCommandRunner: CommandRunner = {
  async run(toolId, values, confirmed) {
    const runId = await invoke<string>("run_tool_cmd", {
      payload: { toolId, values, confirmed },
    });
    const startedAt = Math.floor(Date.now() / 1000);
    const outcome: RunOutcome = {
      runId,
      status: "running",
      exitCode: null,
      startedAt,
      endedAt: null,
      outputFiles: [],
    };
    return outcome;
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
      const o: RunOutcome = {
        runId: e.payload.runId,
        status: e.payload.status,
        exitCode: e.payload.exitCode,
        startedAt: 0,
        endedAt: e.payload.endedAt,
        outputFiles: [],
      };
      cb(e.payload.runId, o);
    });
    return () => { unlistenP.then(fn => fn()).catch(() => {}); };
  },
};
