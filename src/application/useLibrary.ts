import { useCallback, useEffect, useState } from "react";
import { useLibraryClient } from "../state/LibraryContext";
import type { Catalog } from "../domain/library";

type Status = "idle" | "loading" | "ready" | "error";

export function useCatalog() {
  const client = useLibraryClient();
  const [status, setStatus] = useState<Status>("idle");
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setStatus("loading");
    setError(null);
    client
      .fetchCatalog()
      .then((c) => {
        setCatalog(c);
        setStatus("ready");
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : String(e));
        setStatus("error");
      });
  }, [client]);

  useEffect(() => {
    load();
  }, [load]);

  return { status, catalog, error, retry: load };
}

export function useAddTool() {
  const client = useLibraryClient();
  const [busy, setBusy] = useState(false);

  const commit = useCallback(
    async (after: string) => {
      setBusy(true);
      try {
        await client.commitAdd(after);
      } finally {
        setBusy(false);
      }
    },
    [client],
  );

  return { busy, previewAdd: client.installAndPreview, commit };
}

export function useRemoveTool() {
  const client = useLibraryClient();
  const [busy, setBusy] = useState(false);

  const remove = useCallback(
    async (toolId: string) => {
      setBusy(true);
      try {
        await client.commitRemove(toolId);
      } finally {
        setBusy(false);
      }
    },
    [client],
  );

  return { busy, remove };
}
