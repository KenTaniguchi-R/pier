import type { UpdatePrefs } from "./settings";

export interface UpdateInfo {
  version: string;
  currentVersion: string;
  notes: string | null;
  pubDate: string | null;
}

export interface UpdateProgress {
  downloaded: number;
  total: number | null;
}

export type UpdateState =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "available"; info: UpdateInfo }
  | { kind: "downloading"; info: UpdateInfo; progress: UpdateProgress }
  | { kind: "ready"; info: UpdateInfo }
  | { kind: "error"; message: string; lastInfo: UpdateInfo | null };

export const AUTO_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

export function shouldSkip(info: UpdateInfo, prefs: UpdatePrefs, now: number): boolean {
  if (prefs.skippedVersion && prefs.skippedVersion === info.version) return true;
  if (prefs.remindAfter !== null && prefs.remindAfter > now) return true;
  return false;
}

export function dueForCheck(prefs: UpdatePrefs, now: number): boolean {
  if (!prefs.autoCheck) return false;
  if (prefs.remindAfter !== null && prefs.remindAfter > now) return false;
  if (prefs.lastCheckedAt === null) return true;
  return now - prefs.lastCheckedAt >= AUTO_CHECK_INTERVAL_MS;
}
