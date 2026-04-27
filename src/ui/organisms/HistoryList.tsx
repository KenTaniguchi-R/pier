import { useState } from "react";
import { useToolHistory } from "../../state/useToolHistory";
import { HistoryRow } from "../molecules/HistoryRow";
import { RunOutputViewer } from "./RunOutputViewer";
import type { RunSummary } from "../../application/ports";

export function HistoryList({ toolId }: { toolId: string }) {
  const { runs, loading } = useToolHistory(toolId, 10);
  const [active, setActive] = useState<RunSummary | null>(null);

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink-3">
          Log
        </span>
        <span className="flex-1 h-px bg-line" />
        <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-4 tabular-nums">
          {loading ? "·" : runs.length === 0 ? "no entries" : `${runs.length} ${runs.length === 1 ? "entry" : "entries"}`}
        </span>
      </div>

      {!loading && runs.length === 0 && (
        <div className="px-3 py-6 text-center font-display italic text-[13px] text-ink-3">
          The log is empty. Past runs will be recorded here.
        </div>
      )}

      {runs.length > 0 && (
        <div className="flex flex-col rounded-2 border border-line bg-surface overflow-hidden">
          {runs.map((r, i) => (
            <HistoryRow
              key={r.runId}
              run={r}
              index={i}
              selected={active?.runId === r.runId}
              onClick={() => setActive(r)}
            />
          ))}
        </div>
      )}

      {active && <RunOutputViewer run={active} onClose={() => setActive(null)} />}
    </section>
  );
}
