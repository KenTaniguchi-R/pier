import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import type { UpdateController } from "../application/useUpdater";

const Ctx = createContext<UpdateController | null>(null);

export function UpdaterStateProvider({ controller, children }: { controller: UpdateController; children: ReactNode }) {
  return <Ctx.Provider value={controller}>{children}</Ctx.Provider>;
}

export function useUpdaterState(): UpdateController {
  const c = useContext(Ctx);
  if (!c) throw new Error("UpdaterStateProvider missing");
  return c;
}
