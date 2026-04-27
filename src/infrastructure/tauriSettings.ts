import { invoke } from "@tauri-apps/api/core";
import type { SettingsAdapter } from "../application/ports";
import {
  DEFAULT_SETTINGS,
  DEFAULT_UPDATE_PREFS,
  type DeepPartial,
  type HistoryStats,
  type Settings,
} from "../domain/settings";

function withDefaults(s: Partial<Settings> | null | undefined): Settings {
  return {
    launchAtLogin: s?.launchAtLogin ?? DEFAULT_SETTINGS.launchAtLogin,
    update: { ...DEFAULT_UPDATE_PREFS, ...(s?.update ?? {}) },
  };
}

export const tauriSettings: SettingsAdapter = {
  async load() { return withDefaults(await invoke<Settings>("load_settings")); },
  async save(settings) { await invoke("save_settings", { settings }); },
  async patch(partial) { return withDefaults(await invoke<Settings>("patch_settings_cmd", { patch: partial })); },
  async historyStats() { return invoke<HistoryStats>("history_stats_cmd"); },
  async clearHistory() { await invoke("clear_history_cmd"); },
};

let memoryStore: Settings = { ...DEFAULT_SETTINGS };
const memoryStats: HistoryStats = { runCount: 0, bytes: 0 };

function deepMerge<T>(base: T, patch: DeepPartial<T>): T {
  if (patch === null || typeof patch !== "object") return patch as unknown as T;
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const k of Object.keys(patch as Record<string, unknown>)) {
    const v = (patch as Record<string, unknown>)[k];
    const b = out[k];
    if (v && typeof v === "object" && !Array.isArray(v) && b && typeof b === "object") {
      out[k] = deepMerge(b as object, v as DeepPartial<object>);
    } else {
      out[k] = v;
    }
  }
  return out as T;
}

export const browserSettings: SettingsAdapter = {
  async load() { return withDefaults(memoryStore); },
  async save(s) { memoryStore = withDefaults(s); },
  async patch(partial) {
    memoryStore = deepMerge(memoryStore, partial as DeepPartial<Settings>);
    return withDefaults(memoryStore);
  },
  async historyStats() { return { ...memoryStats }; },
  async clearHistory() { memoryStats.runCount = 0; memoryStats.bytes = 0; },
};

export const defaultSettingsAdapter: SettingsAdapter =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window
    ? tauriSettings
    : browserSettings;
