import { invoke } from "@tauri-apps/api/core";
import type { SettingsAdapter } from "../application/ports";
import type { Settings, HistoryStats } from "../domain/settings";

export const tauriSettings: SettingsAdapter = {
  async load() {
    return invoke<Settings>("load_settings");
  },
  async save(settings) {
    await invoke("save_settings", { settings });
  },
  async historyStats() {
    return invoke<HistoryStats>("history_stats_cmd");
  },
  async clearHistory() {
    await invoke("clear_history_cmd");
  },
};

const memoryStore: Settings = { launchAtLogin: false };
const memoryStats: HistoryStats = { runCount: 0, bytes: 0 };

export const browserSettings: SettingsAdapter = {
  async load() {
    return { ...memoryStore };
  },
  async save(s) {
    memoryStore.launchAtLogin = s.launchAtLogin;
  },
  async historyStats() {
    return { ...memoryStats };
  },
  async clearHistory() {
    memoryStats.runCount = 0;
    memoryStats.bytes = 0;
  },
};

export const defaultSettingsAdapter: SettingsAdapter =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window
    ? tauriSettings
    : browserSettings;
