import type { ConfigLoader } from "../application/ports";

export const tauriConfigLoader: ConfigLoader = {
  async load() {
    throw new Error("tauriConfigLoader not implemented (Task 6)");
  },
  watch(_onChange) {
    return () => {};
  },
};
