import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { LibraryClient } from "../application/ports";
import type { Catalog } from "../domain/library";

type Status = "idle" | "loading" | "ready" | "error";

interface CatalogState {
  status: Status;
  catalog: Catalog | null;
  error: string | null;
  retry: () => void;
}

const ClientCtx = createContext<LibraryClient | null>(null);
const CatalogCtx = createContext<CatalogState | null>(null);

/** Mounts once at app root. Owns the (single) catalog fetch so re-entering
 *  the Library route doesn't re-fetch — `LibraryRoute` consumes via `useCatalog`. */
export function LibraryProvider({ client, children }: { client: LibraryClient; children: ReactNode }) {
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

  useEffect(() => { load(); }, [load]);

  return (
    <ClientCtx.Provider value={client}>
      <CatalogCtx.Provider value={{ status, catalog, error, retry: load }}>
        {children}
      </CatalogCtx.Provider>
    </ClientCtx.Provider>
  );
}

export function useLibraryClient() {
  const c = useContext(ClientCtx);
  if (!c) throw new Error("LibraryProvider missing");
  return c;
}

export function useCatalogState() {
  const c = useContext(CatalogCtx);
  if (!c) throw new Error("LibraryProvider missing");
  return c;
}
