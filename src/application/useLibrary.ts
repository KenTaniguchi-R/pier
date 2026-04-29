import { useCallback, useEffect, useState } from "react";
import { useLibraryClient } from "../state/LibraryContext";
import type { Catalog } from "../domain/library";

type Status = "idle" | "loading" | "ready" | "error";

export function useCatalog() {
  const client = useLibraryClient();
  const [status, setStatus] = useState<Status>("idle");
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setStatus("loading");
    setError(null);
    client
      .fetchCatalog()
      .then((c) => {
        setCatalog(c);
        setStatus("ready");
      })
      .catch((e) => {
        setError(String(e));
        setStatus("error");
      });
  }, [client]);

  return { status, catalog, error };
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
