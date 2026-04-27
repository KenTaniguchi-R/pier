import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import type { UpdateChecker } from "../application/ports";

const Ctx = createContext<UpdateChecker | null>(null);

export function UpdaterProvider({ checker, children }: { checker: UpdateChecker; children: ReactNode }) {
  return <Ctx.Provider value={checker}>{children}</Ctx.Provider>;
}

export function useUpdateChecker(): UpdateChecker {
  const c = useContext(Ctx);
  if (!c) throw new Error("UpdaterProvider missing");
  return c;
}
