import { RunControl } from "./RunControl";
import { formatElapsed, useNow } from "./elapsed";

interface Props {
  running: boolean;
  startedAt: number | null;
  canRun: boolean;
  blockedReason?: string;
  onRun: () => void;
  onStop: () => void;
}

function StatusText({
  running,
  elapsedMs,
  canRun,
  blockedReason,
}: {
  running: boolean;
  elapsedMs: number;
  canRun: boolean;
  blockedReason?: string;
}) {
  if (running) {
    return (
      <span className="inline-flex items-center gap-2">
        <span className="size-1.5 rounded-pill bg-warning animate-run-pulse" aria-hidden />
        <span>Running · {formatElapsed(elapsedMs)}</span>
      </span>
    );
  }
  if (blockedReason) return <>{blockedReason}</>;
  if (canRun) return <span aria-hidden>⌘↵ to run</span>;
  return null;
}

/**
 * Sticky bottom action bar for the tool detail screen. Owns the bar chrome;
 * delegates the button to RunControl. Must be a sibling of the scroll
 * container so `sticky bottom-0` pins to the detail viewport.
 */
export function RunActionBar({
  running,
  startedAt,
  canRun,
  blockedReason,
  onRun,
  onStop,
}: Props) {
  const now = useNow(running);
  const elapsedMs = running && startedAt ? now - startedAt : 0;

  return (
    <footer
      aria-label="Run controls"
      className="sticky bottom-0 flex-none flex items-center justify-between gap-4 px-10 py-2.5 border-t border-line bg-bg/85 backdrop-blur-sm"
    >
      <span className="font-mono text-[11px] text-ink-3 truncate">
        <StatusText
          running={running}
          elapsedMs={elapsedMs}
          canRun={canRun}
          blockedReason={blockedReason}
        />
      </span>

      <RunControl running={running} canRun={canRun} onRun={onRun} onStop={onStop} />
    </footer>
  );
}
