import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { ConfigLoader } from "../application/ports";

export const tauriConfigLoader: ConfigLoader = {
  async load() {
    const path = await invoke<string>("config_path");
    const raw = await invoke<unknown>("load_tools_config", { path });
    return { raw, pathHint: path };
  },
  watch(onChange) {
    const unlistenP = listen("pier://config-changed", () => onChange());
    return () => {
      unlistenP.then(fn => fn()).catch(() => {});
    };
  },
};
