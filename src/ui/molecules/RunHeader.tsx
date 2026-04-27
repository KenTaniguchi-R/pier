import type { RunStatus } from "../../domain/runRequest";
import { CopyButton } from "./CopyButton";
import { RUN_STATUS_STYLE } from "./runStatusStyle";

interface Props {
  status: RunStatus;
  startedAt: number;
  endedAt: number | null;
  exitCode: number | null;
  lineCount: number;
  getOutputText?: () => string;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(s < 10 ? 2 : 1)}s`;
  const m = Math.floor(s / 60);
  const rs = Math.round(s - m * 60);
  return `${m}m ${rs}s`;
}

export function RunHeader({ status, startedAt, endedAt, exitCode, lineCount, getOutputText }: Props) {
  const style = RUN_STATUS_STYLE[status];
  const duration = endedAt ? endedAt - startedAt : null;
  const showLines = lineCount > 0;
  const showExit = exitCode !== null && exitCode !== 0;

  return (
    <header className="flex-none flex items-center gap-4 px-5 py-2.5 border-b border-line">
      <span className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em]">
        {status === "running" && (
          <span className="size-1.5 rounded-pill bg-warning animate-run-pulse" aria-hidden />
        )}
        <span className={style.text}>{style.label}</span>
      </span>
      <span className="ml-auto flex items-center gap-3 font-mono text-[11px] text-ink-3">
        {duration !== null && <span>{formatDuration(duration)}</span>}
        {duration !== null && showLines && <span aria-hidden className="text-ink-4">·</span>}
        {showLines && <span>{lineCount} {lineCount === 1 ? "line" : "lines"}</span>}
        {showExit && (
          <>
            <span aria-hidden className="text-ink-4">·</span>
            <span className="text-danger">exit {exitCode}</span>
          </>
        )}
        {getOutputText && showLines && (
          <>
            <span aria-hidden className="text-ink-4">·</span>
            <CopyButton getText={getOutputText} />
          </>
        )}
      </span>
    </header>
  );
}
