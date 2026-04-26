import { useApp } from "../../state/AppContext";
import { LogLine } from "../molecules/LogLine";
import { RunStatusPill } from "../molecules/RunStatusPill";

export function LogPanel() {
  const { state } = useApp();
  const id = state.selectedRunId;
  const run = id ? state.runs[id] : null;

  if (!run) {
    return (
      <div className="log-panel log-panel--empty">
        <span className="log-panel__hint">// SELECT A TOOL TO BEGIN</span>
      </div>
    );
  }

  return (
    <section className="log-panel">
      <header className="log-panel__head">
        <span className="log-panel__eyebrow">// RUN · {id?.slice(0, 8)}</span>
        <RunStatusPill status={run.status} />
        {run.exitCode !== null && <span className="log-panel__exit">EXIT {run.exitCode}</span>}
      </header>
      <div className="log-panel__body">
        {run.lines.length === 0 && <span className="log-panel__hint">// AWAITING OUTPUT…</span>}
        {run.lines.map((l, i) => (
          <LogLine key={i} ts={l.ts} line={l.line} stream={l.stream} lineNumber={i + 1} />
        ))}
      </div>
    </section>
  );
}
