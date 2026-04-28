import { useCallback, useEffect, useState } from "react";
import { useHistory } from "./HistoryContext";
import { useRunner } from "./RunnerContext";
import type { RecentToolRun } from "../application/ports";

/** Cross-tool recent runs, deduped by toolId, newest first.
 *  Refreshes whenever any run exits. */
export function useRecentTools(limit = 6): {
  tools: RecentToolRun[];
  loading: boolean;
  refresh: () => void;
} {
  const history = useHistory();
  const runner = useRunner();
  const [tools, setTools] = useState<RecentToolRun[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setTools(await history.listRecentTools(limit));
    } finally {
      setLoading(false);
    }
  }, [history, limit]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const off = runner.onExit(() => {
      refresh();
    });
    return off;
  }, [runner, refresh]);

  return { tools, loading, refresh };
}
