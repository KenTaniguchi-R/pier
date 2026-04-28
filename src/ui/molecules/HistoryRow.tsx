import type { RunSummary } from "../../application/ports";
import { formatDuration, relativeTime } from "./elapsed";

const GLYPH: Record<RunSummary["status"], string> = {
  pending: "◦",
  success: "✓",
  failed:  "✗",
  killed:  "—",
  running: "◦",
};

const GLYPH_TONE: Record<RunSummary["status"], string> = {
  pending: "text-ink-4",
  success: "text-success",
  failed:  "text-danger",
  killed:  "text-ink-4",
  running: "text-accent",
};

export function HistoryRow({
  run,
  onClick,
  selected = false,
  index,
}: {
  run: RunSummary;
  onClick: () => void;
  selected?: boolean;
  index: number;
}) {
  const duration = run.endedAt != null ? formatDuration(run.endedAt - run.startedAt) : null;
  const exitTag =
    run.status === "running"
      ? "running"
      : run.exitCode != null
        ? `exit ${run.exitCode}`
        : run.status;

  return (
    <button
      type="button"
      onClick={onClick}
      style={{ animationDelay: `${Math.min(index, 9) * 24}ms` }}
      className={`group relative w-full flex items-baseline gap-3 px-2 py-2 text-left border-b border-line/70 last:border-b-0 transition-colors duration-150 ease-(--ease-smooth) animate-ledger-row ${
        selected ? "bg-bg-2" : "hover:bg-surface-2"
      }`}
    >
      {selected && (
        <span className="absolute left-0 top-1.5 bottom-1.5 w-[2px] bg-accent" aria-hidden />
      )}

      {/* Status glyph — typographic, in mono small caps */}
      <span className={`flex-none w-4 font-mono text-[12.5px] leading-none ${GLYPH_TONE[run.status]}`} aria-hidden>
        {GLYPH[run.status]}
      </span>

      {/* Time — italic display serif, ledger-handwritten feel */}
      <span className="flex-1 min-w-0 truncate font-display italic text-[13px] text-ink leading-tight">
        {relativeTime(run.startedAt)}
      </span>

      {/* Duration — mono, em-dashed */}
      {duration && (
        <span className="flex-none font-mono text-[11px] text-ink-3 tabular-nums">
          — {duration}
        </span>
      )}

      {/* Exit tag — mono small caps */}
      <span className="flex-none font-mono text-[10px] uppercase tracking-[0.14em] text-ink-4 group-hover:text-ink-3">
        {exitTag}
      </span>
    </button>
  );
}
