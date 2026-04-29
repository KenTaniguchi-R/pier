import { useCallback, useEffect, useState } from "react";
import { useLibraryClient } from "../state/LibraryContext";
import type { Catalog, CatalogTool } from "../domain/library";
import type { LibraryAddPreview } from "./ports";

type Status = "idle" | "loading" | "ready" | "error";

export function useCatalog() {
  const client = useLibraryClient();
  const [status, setStatus] = useState<Status>("idle");
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setStatus("loading");
    setError(null);
    try {
      const c = await client.fetchCatalog();
      setCatalog(c);
      setStatus("ready");
    } catch (e) {
      setError(String(e));
      setStatus("error");
    }
  }, [client]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { status, catalog, error, refresh };
}

export function useAddTool() {
  const client = useLibraryClient();
  const [busy, setBusy] = useState(false);

  const previewAdd = useCallback(
    (tool: CatalogTool): Promise<LibraryAddPreview> => client.installAndPreview(tool),
    [client],
  );
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

  return { busy, previewAdd, commit };
}
