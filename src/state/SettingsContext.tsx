import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import type { SettingsAdapter } from "../application/ports";
import { browserSettings } from "../infrastructure/tauriSettings";

const Ctx = createContext<SettingsAdapter>(browserSettings);

export function SettingsProvider({
  adapter,
  children,
}: {
  adapter: SettingsAdapter;
  children: ReactNode;
}) {
  return <Ctx.Provider value={adapter}>{children}</Ctx.Provider>;
}

export function useSettingsAdapter(): SettingsAdapter {
  return useContext(Ctx);
}
