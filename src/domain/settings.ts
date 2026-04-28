export interface UpdatePrefs {
  autoCheck: boolean;
  skippedVersion: string | null;
  remindAfter: number | null;
  lastCheckedAt: number | null;
}

export interface Settings {
  launchAtLogin: boolean;
  update: UpdatePrefs;
  favorites: string[];
}

export const DEFAULT_UPDATE_PREFS: UpdatePrefs = {
  autoCheck: true,
  skippedVersion: null,
  remindAfter: null,
  lastCheckedAt: null,
};

export const DEFAULT_SETTINGS: Settings = {
  launchAtLogin: false,
  update: DEFAULT_UPDATE_PREFS,
  favorites: [],
};

export interface HistoryStats {
  runCount: number;
  bytes: number;
}

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object | null
    ? T[K] extends null
      ? T[K] | null
      : DeepPartial<NonNullable<T[K]>> | null
    : T[K];
};
