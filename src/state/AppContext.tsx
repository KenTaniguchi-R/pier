import { createContext, useContext, useReducer } from "react";
import type { ReactNode } from "react";
import { reducer, initialState } from "./reducer";
import type { AppState } from "./reducer";
import type { Action } from "./actions";

const Ctx = createContext<{ state: AppState; dispatch: (a: Action) => void } | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  return <Ctx.Provider value={{ state, dispatch }}>{children}</Ctx.Provider>;
}

export function useApp() {
  const c = useContext(Ctx);
  if (!c) throw new Error("AppProvider missing");
  return c;
}
