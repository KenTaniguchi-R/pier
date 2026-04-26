import { invoke } from "@tauri-apps/api/core";
import type { ConfigLoader } from "../application/ports";

export const tauriConfigLoader: ConfigLoader = {
  async load() {
    const path = await invoke<string>("config_path");
    const raw = await invoke<unknown>("load_tools_config", { path });
    return { raw, pathHint: path };
  },
  watch(_onChange) {
    return () => {}; // implemented in Phase 5 (hot reload, Task 16)
  },
};
