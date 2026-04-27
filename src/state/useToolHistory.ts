import { useEffect, useState, useCallback } from "react";
import { useHistory } from "./HistoryContext";
import { useRunner } from "./RunnerContext";
import type { RunSummary } from "../application/ports";

export function useToolHistory(toolId: string, limit = 10): {
  runs: RunSummary[];
  loading: boolean;
  refresh: () => void;
} {
  const history = useHistory();
  const runner = useRunner();
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const next = await history.list(toolId, limit);
      setRuns(next);
    } finally {
      setLoading(false);
    }
  }, [history, toolId, limit]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    const off = runner.onExit(() => { refresh(); });
    return off;
  }, [runner, refresh]);

  return { runs, loading, refresh };
}
