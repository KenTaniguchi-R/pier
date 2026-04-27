import { useCallback, useEffect, useState } from "react";
import { DEFAULT_SETTINGS, type HistoryStats, type Settings } from "../domain/settings";
import { useSettingsAdapter } from "../state/SettingsContext";

export interface SettingsController {
  settings: Settings;
  stats: HistoryStats | null;
  setLaunchAtLogin: (next: boolean) => Promise<void>;
  savingLogin: boolean;
  setAutoCheck: (next: boolean) => Promise<void>;
  clearHistory: () => Promise<void>;
  clearing: boolean;
  justCleared: boolean;
}

export function useSettings(): SettingsController {
  const adapter = useSettingsAdapter();
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [stats, setStats] = useState<HistoryStats | null>(null);
  const [savingLogin, setSavingLogin] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [justCleared, setJustCleared] = useState(false);

  const refreshStats = useCallback(() => {
    adapter.historyStats().then(setStats).catch(() => setStats({ runCount: 0, bytes: 0 }));
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
      const merged = await adapter.patch({ launchAtLogin: next });
      setSettings(merged);
    } catch { setSettings(prev); }
    finally { setSavingLogin(false); }
  };

  const setAutoCheck = async (next: boolean) => {
    const prev = settings;
    setSettings({ ...prev, update: { ...prev.update, autoCheck: next } });
    try {
      const merged = await adapter.patch({ update: { autoCheck: next } });
      setSettings(merged);
    } catch { setSettings(prev); }
  };

  const clearHistory = async () => {
    setClearing(true);
    try {
      await adapter.clearHistory();
      setJustCleared(true);
      setTimeout(() => setJustCleared(false), 1800);
      refreshStats();
    } finally { setClearing(false); }
  };

  return { settings, stats, setLaunchAtLogin, savingLogin, setAutoCheck, clearHistory, clearing, justCleared };
}
