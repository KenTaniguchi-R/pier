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
        <div>
          <span className="log-panel__hint-em">Pick a tool to start</span>
          <span className="log-panel__hint">Or drop a file onto one of the tools on the left.</span>
        </div>
      </div>
    );
  }

  return (
    <section className="log-panel">
      <header className="log-panel__head">
        <span className="log-panel__title">Output</span>
        <RunStatusPill status={run.status} />
        {run.exitCode !== null && run.exitCode !== 0 && (
          <span className="log-panel__exit">exit {run.exitCode}</span>
        )}
      </header>
      <div className="log-panel__body">
        {run.lines.length === 0 && <span className="log-panel__hint">Waiting for the tool to respond…</span>}
        {run.lines.map((l, i) => (
          <LogLine key={i} ts={l.ts} line={l.line} stream={l.stream} lineNumber={i + 1} />
        ))}
      </div>
    </section>
  );
}
