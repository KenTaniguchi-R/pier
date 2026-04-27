import { describe, it, expect } from "vitest";
import { shouldSkip, dueForCheck, AUTO_CHECK_INTERVAL_MS } from "../update";
import { DEFAULT_UPDATE_PREFS, type UpdatePrefs } from "../settings";

const NOW = 1_700_000_000_000;
const info = (v: string) => ({ version: v, currentVersion: "0.1.0", notes: null, pubDate: null });

describe("shouldSkip", () => {
  it("skips when version matches skippedVersion", () => {
    const prefs: UpdatePrefs = { ...DEFAULT_UPDATE_PREFS, skippedVersion: "0.2.0" };
    expect(shouldSkip(info("0.2.0"), prefs, NOW)).toBe(true);
  });
  it("does not skip when versions differ", () => {
    const prefs: UpdatePrefs = { ...DEFAULT_UPDATE_PREFS, skippedVersion: "0.1.5" };
    expect(shouldSkip(info("0.2.0"), prefs, NOW)).toBe(false);
  });
  it("skips while remindAfter is in the future", () => {
    const prefs: UpdatePrefs = { ...DEFAULT_UPDATE_PREFS, remindAfter: NOW + 1000 };
    expect(shouldSkip(info("0.2.0"), prefs, NOW)).toBe(true);
  });
  it("does not skip after remindAfter has passed", () => {
    const prefs: UpdatePrefs = { ...DEFAULT_UPDATE_PREFS, remindAfter: NOW - 1000 };
    expect(shouldSkip(info("0.2.0"), prefs, NOW)).toBe(false);
  });
  it("does not skip with default prefs", () => {
    expect(shouldSkip(info("0.2.0"), DEFAULT_UPDATE_PREFS, NOW)).toBe(false);
  });
});

describe("dueForCheck", () => {
  it("false when autoCheck off", () => {
    expect(dueForCheck({ ...DEFAULT_UPDATE_PREFS, autoCheck: false }, NOW)).toBe(false);
  });
  it("true when never checked", () => {
    expect(dueForCheck(DEFAULT_UPDATE_PREFS, NOW)).toBe(true);
  });
  it("false when within interval", () => {
    expect(dueForCheck({ ...DEFAULT_UPDATE_PREFS, lastCheckedAt: NOW - 1000 }, NOW)).toBe(false);
  });
  it("true when past interval", () => {
    expect(
      dueForCheck({ ...DEFAULT_UPDATE_PREFS, lastCheckedAt: NOW - AUTO_CHECK_INTERVAL_MS - 1000 }, NOW),
    ).toBe(true);
  });
  it("false when remindAfter is in the future", () => {
    expect(
      dueForCheck(
        { ...DEFAULT_UPDATE_PREFS, lastCheckedAt: NOW - AUTO_CHECK_INTERVAL_MS - 1000, remindAfter: NOW + 1000 },
        NOW,
      ),
    ).toBe(false);
  });
});
