import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import type { LibraryClient } from "../application/ports";

const Ctx = createContext<LibraryClient | null>(null);

export function LibraryProvider({ client, children }: { client: LibraryClient; children: ReactNode }) {
  return <Ctx.Provider value={client}>{children}</Ctx.Provider>;
}

export function useLibrary() {
  const c = useContext(Ctx);
  if (!c) throw new Error("LibraryProvider missing");
  return c;
}
