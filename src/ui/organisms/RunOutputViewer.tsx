import { useEffect, useState } from "react";
import { useHistory } from "../../state/HistoryContext";
import type { RunLogLine, RunSummary } from "../../application/ports";

const STATUS_TONE: Record<RunSummary["status"], string> = {
  pending: "text-ink-3  border-line       bg-bg-2",
  success: "text-success border-success/40 bg-success-soft",
  failed:  "text-danger  border-danger/40  bg-danger-soft",
  killed:  "text-ink-3  border-line       bg-bg-2",
  running: "text-accent border-accent-edge bg-accent-soft",
};

function fmtAbsolute(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

export function RunOutputViewer({ run, onClose }: { run: RunSummary; onClose: () => void }) {
  const history = useHistory();
  const [lines, setLines] = useState<RunLogLine[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLines(null);
    setError(null);
    if (!run.outputPath) {
      setError("No captured output for this run.");
      return;
    }
    history.readOutput(run.outputPath).then(
      ls => { if (!cancelled) setLines(ls); },
      e => { if (!cancelled) setError(String(e)); },
    );
    return () => { cancelled = true; };
  }, [history, run.outputPath]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center px-6 py-10 animate-overlay-in"
      style={{ background: "color-mix(in oklab, var(--color-ink) 22%, transparent)" }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="bg-surface border border-line-hi rounded-[14px] shadow-pop w-[min(880px,92vw)] max-h-[82vh] flex flex-col overflow-hidden animate-panel-in"
        onClick={e => e.stopPropagation()}
      >
        {/* Header — serif italic title with ledger-style typographic detail */}
        <header className="flex items-baseline gap-4 px-6 pt-5 pb-4 border-b border-line">
          <span className="font-display italic text-[20px] leading-none text-ink tracking-[-0.005em]">
            Run output
          </span>
          <span className="flex-1 h-px bg-line translate-y-[-2px]" aria-hidden />
          <span
            className={`font-mono text-[10px] uppercase tracking-[0.16em] px-2 py-[3px] rounded-pill border ${STATUS_TONE[run.status]}`}
          >
            {run.status}
            {run.exitCode != null && ` · ${run.exitCode}`}
          </span>
        </header>

        {/* Meta line — small caps mono, in line with the rest of Pier */}
        <div className="flex items-center gap-4 px-6 py-2 bg-bg border-b border-line font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-3">
          <span>started {fmtAbsolute(run.startedAt)}</span>
          {run.endedAt != null && (
            <>
              <span aria-hidden className="text-ink-4">/</span>
              <span>ended {fmtAbsolute(run.endedAt)}</span>
            </>
          )}
          {run.outputBytes != null && (
            <>
              <span aria-hidden className="text-ink-4">/</span>
              <span>{fmtBytes(run.outputBytes)}{run.outputTruncated ? " — truncated" : ""}</span>
            </>
          )}
          <span className="flex-1" />
          <span className="text-ink-4">esc to close</span>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto bg-surface-2/40">
          {error && (
            <div className="px-6 py-5 font-display italic text-[13px] text-danger">
              {error}
            </div>
          )}
          {!error && lines == null && (
            <div className="px-6 py-5 font-display italic text-[13px] text-ink-3">
              loading…
            </div>
          )}
          {!error && lines != null && lines.length === 0 && (
            <div className="px-6 py-5 font-display italic text-[13px] text-ink-3">
              (no captured output)
            </div>
          )}
          {!error && lines != null && lines.length > 0 && (
            <div className="font-mono text-[12.5px] leading-[1.55] py-2">
              {lines.map((l, i) => {
                const isTruncationMarker = l.t === "[output truncated]";
                if (isTruncationMarker) {
                  return (
                    <div
                      key={i}
                      className="flex items-center gap-3 px-6 py-3 mt-1 font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink-4"
                    >
                      <span className="flex-1 h-px bg-line" aria-hidden />
                      <span>output truncated</span>
                      <span className="flex-1 h-px bg-line" aria-hidden />
                    </div>
                  );
                }
                return (
                  <div
                    key={i}
                    className={`flex items-start gap-4 px-6 py-[1px] hover:bg-bg-2/50 ${
                      l.s === "stderr" ? "text-danger" : "text-ink"
                    }`}
                  >
                    <span
                      className="flex-none w-8 text-right text-ink-4 select-none tabular-nums"
                      aria-hidden
                    >
                      {i + 1}
                    </span>
                    <span className="flex-1 whitespace-pre-wrap break-words min-w-0">
                      {l.t || " "}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
