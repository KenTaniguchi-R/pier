import type { ReactNode } from "react";
import { useUpdater } from "../application/useUpdater";
import { UpdaterStateProvider } from "./UpdaterStateContext";

export function UpdaterControllerHost({ children }: { children: ReactNode }) {
  const ctrl = useUpdater();
  return <UpdaterStateProvider controller={ctrl}>{children}</UpdaterStateProvider>;
}
