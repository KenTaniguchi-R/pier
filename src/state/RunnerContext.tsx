import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import type { CommandRunner } from "../application/ports";

const Ctx = createContext<CommandRunner | null>(null);

export function RunnerProvider({ runner, children }: { runner: CommandRunner; children: ReactNode }) {
  return <Ctx.Provider value={runner}>{children}</Ctx.Provider>;
}

export function useRunner(): CommandRunner {
  const r = useContext(Ctx);
  if (!r) throw new Error("RunnerProvider missing");
  return r;
}
