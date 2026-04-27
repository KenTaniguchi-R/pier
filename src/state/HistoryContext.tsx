import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import type { HistoryReader } from "../application/ports";

const Ctx = createContext<HistoryReader | null>(null);

export function HistoryProvider({ history, children }: { history: HistoryReader; children: ReactNode }) {
  return <Ctx.Provider value={history}>{children}</Ctx.Provider>;
}

export function useHistory(): HistoryReader {
  const h = useContext(Ctx);
  if (!h) throw new Error("HistoryProvider missing");
  return h;
}
