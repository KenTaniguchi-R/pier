import { useCallback, useEffect, useState } from "react";
import { DEFAULT_SETTINGS, type HistoryStats, type Settings } from "../domain/settings";
import { useSettingsAdapter } from "../state/SettingsContext";

export interface SettingsController {
  settings: Settings;
  stats: HistoryStats | null;

  setLaunchAtLogin: (next: boolean) => Promise<void>;
  savingLogin: boolean;

  clearHistory: () => Promise<void>;
  clearing: boolean;
  justCleared: boolean;
}

/**
 * Orchestrates the Settings page: loads persisted settings + history stats,
 * exposes idempotent mutators that refresh the relevant slice on success.
 *
 * UI-agnostic — returns plain values consumed by SettingsPage.
 */
export function useSettings(): SettingsController {
  const adapter = useSettingsAdapter();
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [stats, setStats] = useState<HistoryStats | null>(null);
  const [savingLogin, setSavingLogin] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [justCleared, setJustCleared] = useState(false);

  const refreshStats = useCallback(() => {
    adapter
      .historyStats()
      .then(setStats)
      .catch(() => setStats({ runCount: 0, bytes: 0 }));
  }, [adapter]);

  useEffect(() => {
    adapter.load().then(setSettings).catch(() => {});
    refreshStats();
  }, [adapter, refreshStats]);

  const setLaunchAtLogin = async (next: boolean) => {
    const prev = settings;
    setSettings({ ...prev, launchAtLogin: next });
    setSavingLogin(true);
    try {
      await adapter.save({ ...prev, launchAtLogin: next });
    } catch {
      setSettings(prev);
    } finally {
      setSavingLogin(false);
    }
  };

  const clearHistory = async () => {
    setClearing(true);
    try {
      await adapter.clearHistory();
      setJustCleared(true);
      setTimeout(() => setJustCleared(false), 1800);
      refreshStats();
    } finally {
      setClearing(false);
    }
  };

  return {
    settings,
    stats,
    setLaunchAtLogin,
    savingLogin,
    clearHistory,
    clearing,
    justCleared,
  };
}
