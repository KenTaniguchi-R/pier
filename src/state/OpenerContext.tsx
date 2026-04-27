import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import type { UrlOpener } from "../application/ports";

const noopOpener: UrlOpener = { open: async () => {} };

const Ctx = createContext<UrlOpener>(noopOpener);

export function OpenerProvider({ opener, children }: { opener: UrlOpener; children: ReactNode }) {
  return <Ctx.Provider value={opener}>{children}</Ctx.Provider>;
}

export function useOpener(): UrlOpener {
  return useContext(Ctx);
}
