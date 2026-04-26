import { useApp } from "../../state/AppContext";
import { LogLine } from "../molecules/LogLine";
import { RunHeader } from "../molecules/RunHeader";
import { RUN_STATUS_STYLE } from "../molecules/runStatusStyle";

const SHELL =
  "flex flex-col h-full rounded-[14px] bg-surface border border-line overflow-hidden " +
  "border-l-[3px] transition-[border-color] duration-200 ease-(--ease-smooth)";

function EmptyShell({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${SHELL} border-l-line items-center justify-center`}>
      <div className="text-center px-6">{children}</div>
    </div>
  );
}

interface Props { toolId: string }

export function LogPanel({ toolId }: Props) {
  const { state } = useApp();
  const runId = state.selectedRunIdByTool[toolId];
  const run = runId ? state.runs[runId] : null;

  if (!run) {
    return (
      <EmptyShell>
        <span className="block font-display italic text-[17px] text-ink-2 mb-1">
          Awaiting input.
        </span>
        <span className="block text-[13px] text-ink-3 font-body">
          Drop a file above, or paste, then hit Run.
        </span>
      </EmptyShell>
    );
  }

  const edge = RUN_STATUS_STYLE[run.status].edge;
  const isFinal = run.status === "success" || run.status === "failed" || run.status === "killed";
  const lineCount = run.lines.length;

  return (
    <section className={`${SHELL} ${edge}`}>
      <RunHeader
        status={run.status}
        startedAt={run.startedAt}
        endedAt={run.endedAt}
        exitCode={run.exitCode}
        lineCount={lineCount}
      />
      <div className="flex-1 overflow-y-auto py-3 flex flex-col">
        {lineCount === 0 && run.status === "running" && (
          <span className="block px-5 py-3 font-mono text-[12.5px] text-ink-3 italic">
            <span
              className="inline-block size-1.5 rounded-pill bg-ink-4 animate-run-pulse mr-2 translate-y-[-2px]"
              aria-hidden
            />
            waiting for output…
          </span>
        )}
        {lineCount === 0 && run.status !== "running" && (
          <span className="block px-5 py-3 font-mono text-[12.5px] text-ink-3 italic">
            (no output)
          </span>
        )}
        {run.lines.map((l, i) => (
          <LogLine key={i} line={l.line} stream={l.stream} />
        ))}
        {isFinal && lineCount > 0 && (
          <div
            aria-hidden
            className="flex items-center gap-3 px-5 pt-3 pb-1 font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink-4"
          >
            <span className="flex-1 h-px bg-line" />
            end
            <span className="flex-1 h-px bg-line" />
          </div>
        )}
      </div>
    </section>
  );
}
