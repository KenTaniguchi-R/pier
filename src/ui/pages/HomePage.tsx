import { useEffect, useCallback } from "react";
import { useApp } from "../../state/AppContext";
import { useRunner } from "../../state/RunnerContext";
import { AppShell } from "../templates/AppShell";
import { ToolGrid } from "../organisms/ToolGrid";
import { LogPanel } from "../organisms/LogPanel";
import { loadConfig } from "../../application/loadConfig";
import { tauriConfigLoader } from "../../infrastructure/tauriConfigLoader";

function Header() {
  return (
    <div className="page-head">
      <h1 className="page-head__title">Pier</h1>
      <span className="page-head__sub">Your toolbox</span>
    </div>
  );
}

export function HomePage() {
  const { dispatch } = useApp();
  const runner = useRunner();

  const reload = useCallback(async () => {
    try {
      const r = await loadConfig(tauriConfigLoader);
      if (r.ok) dispatch({ type: "CONFIG_LOADED", tools: r.value.tools });
      else dispatch({ type: "CONFIG_ERROR", errors: r.errors });
    } catch (err) {
      dispatch({ type: "CONFIG_ERROR", errors: [String(err)] });
    }
  }, [dispatch]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    const off = tauriConfigLoader.watch(() => {
      reload();
    });
    return off;
  }, [reload]);

  useEffect(() => {
    const offOut = runner.onOutput((runId, line, stream) =>
      dispatch({ type: "RUN_OUTPUT", runId, line, stream })
    );
    const offExit = runner.onExit((runId, o) =>
      dispatch({ type: "RUN_EXIT", runId, status: o.status, exitCode: o.exitCode, endedAt: o.endedAt ?? 0 })
    );
    return () => { offOut(); offExit(); };
  }, [runner, dispatch]);

  return (
    <AppShell
      header={<Header />}
      sidebar={<ToolGrid />}
      main={<LogPanel />}
    />
  );
}
