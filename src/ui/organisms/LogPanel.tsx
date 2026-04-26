import { useApp } from "../../state/AppContext";
import { LogLine } from "../molecules/LogLine";
import { RunStatusPill } from "../molecules/RunStatusPill";

export function LogPanel() {
  const { state } = useApp();
  const id = state.selectedRunId;
  const run = id ? state.runs[id] : null;

  if (!run) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <span className="block font-display text-[18px] font-semibold text-ink mb-1">
            Pick a tool to start
          </span>
          <span className="block px-4 text-[14px] text-ink-3 font-body">
            Or drop a file onto one of the tools on the left.
          </span>
        </div>
      </div>
    );
  }

  return (
    <section className="flex flex-col h-full">
      <header className="flex-none flex items-center gap-2 px-4 py-3 border-b border-line">
        <span className="font-display text-[16px] font-semibold text-ink">Output</span>
        <RunStatusPill status={run.status} />
        {run.exitCode !== null && run.exitCode !== 0 && (
          <span className="ml-auto font-mono font-medium text-[12px] leading-none text-ink-3">
            exit {run.exitCode}
          </span>
        )}
      </header>
      <div className="flex-1 overflow-y-auto py-3 flex flex-col gap-px">
        {run.lines.length === 0 && (
          <span className="block px-4 py-8 text-[14px] text-ink-3 text-center font-body">
            Waiting for the tool to respond…
          </span>
        )}
        {run.lines.map((l, i) => (
          <LogLine key={i} ts={l.ts} line={l.line} stream={l.stream} lineNumber={i + 1} />
        ))}
      </div>
    </section>
  );
}
