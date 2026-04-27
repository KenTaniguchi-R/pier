export interface Settings {
  launchAtLogin: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  launchAtLogin: false,
};

export interface HistoryStats {
  runCount: number;
  bytes: number;
}
