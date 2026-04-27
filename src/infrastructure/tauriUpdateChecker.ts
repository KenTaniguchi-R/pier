import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { UpdateChecker } from "../application/ports";
import type { UpdateInfo, UpdateProgress } from "../domain/update";

export const tauriUpdateChecker: UpdateChecker = {
  async check() { return invoke<UpdateInfo | null>("check_update_cmd"); },
  async installAndRelaunch(onProgress) {
    let unlisten: UnlistenFn | null = null;
    try {
      unlisten = await listen<UpdateProgress>("pier://update-progress", (e) => onProgress(e.payload));
      await invoke("install_update_cmd");
    } finally {
      if (unlisten) unlisten();
    }
  },
  async isTranslocated() { return invoke<boolean>("is_translocated_cmd"); },
};

export const browserUpdateChecker: UpdateChecker = {
  async check() { return null; },
  async installAndRelaunch() { throw new Error("Updater unavailable in browser preview"); },
  async isTranslocated() { return false; },
};

export const defaultUpdateChecker: UpdateChecker =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window
    ? tauriUpdateChecker
    : browserUpdateChecker;
