import { useEffect } from "react";
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
      <span className="page-head__eyebrow">// LAUNCHER · 0.1.0</span>
      <h1 className="page-head__title">PIER</h1>
    </div>
  );
}

export function HomePage() {
  const { dispatch } = useApp();
  const runner = useRunner();

  useEffect(() => {
    let cancelled = false;
    loadConfig(tauriConfigLoader).then(r => {
      if (cancelled) return;
      if (r.ok) dispatch({ type: "CONFIG_LOADED", tools: r.value.tools });
      else dispatch({ type: "CONFIG_ERROR", errors: r.errors });
    }).catch(err => {
      if (!cancelled) dispatch({ type: "CONFIG_ERROR", errors: [String(err)] });
    });
    return () => { cancelled = true; };
  }, [dispatch]);

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
