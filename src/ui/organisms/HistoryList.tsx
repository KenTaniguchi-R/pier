import { useState } from "react";
import { useToolHistory } from "../../state/useToolHistory";
import { HistoryRow } from "../molecules/HistoryRow";
import { StripHeader } from "../molecules/StripHeader";
import { RunOutputViewer } from "./RunOutputViewer";
import type { RunSummary } from "../../application/ports";

export function HistoryList({ toolId }: { toolId: string }) {
  const { runs, loading } = useToolHistory(toolId, 10);
  const [active, setActive] = useState<RunSummary | null>(null);

  const meta = loading
    ? "·"
    : runs.length === 0
      ? "no entries"
      : `${runs.length} ${runs.length === 1 ? "entry" : "entries"}`;

  return (
    <section className="flex flex-col gap-2">
      <StripHeader label="Log" meta={meta} />

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
