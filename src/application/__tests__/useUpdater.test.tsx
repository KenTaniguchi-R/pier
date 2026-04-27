import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { UpdaterProvider } from "../../state/UpdaterContext";
import { SettingsProvider } from "../../state/SettingsContext";
import { browserSettings } from "../../infrastructure/tauriSettings";
import { useUpdater } from "../useUpdater";
import type { UpdateChecker } from "../ports";
import { DEFAULT_SETTINGS } from "../../domain/settings";

function makeChecker(overrides: Partial<UpdateChecker> = {}): UpdateChecker {
  return {
    check: vi.fn().mockResolvedValue(null),
    installAndRelaunch: vi.fn().mockResolvedValue(undefined),
    isTranslocated: vi.fn().mockResolvedValue(false),
    ...overrides,
  };
}

function wrap(checker: UpdateChecker) {
  return ({ children }: { children: ReactNode }) => (
    <SettingsProvider adapter={browserSettings}>
      <UpdaterProvider checker={checker}>{children}</UpdaterProvider>
    </SettingsProvider>
  );
}

beforeEach(async () => { await browserSettings.save({ ...DEFAULT_SETTINGS }); });

describe("useUpdater", () => {
  it("idle on mount when no update", async () => {
    const checker = makeChecker();
    const { result } = renderHook(() => useUpdater(), { wrapper: wrap(checker) });
    await waitFor(() => expect(checker.check).toHaveBeenCalled());
    expect(result.current.state.kind).toBe("idle");
  });

  it("auto-downloads to ready when update available", async () => {
    const info = { version: "0.2.0", currentVersion: "0.1.0", notes: null, pubDate: null };
    const checker = makeChecker({
      check: vi.fn().mockResolvedValue(info),
      installAndRelaunch: vi.fn(async (cb) => { cb({ downloaded: 100, total: 100 }); }),
    });
    const { result } = renderHook(() => useUpdater(), { wrapper: wrap(checker) });
    await waitFor(() => expect(result.current.state.kind).toBe("ready"));
  });

  it("skipped version short-circuits to idle", async () => {
    await browserSettings.save({
      ...DEFAULT_SETTINGS,
      update: { ...DEFAULT_SETTINGS.update, skippedVersion: "0.2.0" },
    });
    const info = { version: "0.2.0", currentVersion: "0.1.0", notes: null, pubDate: null };
    const checker = makeChecker({ check: vi.fn().mockResolvedValue(info) });
    const { result } = renderHook(() => useUpdater(), { wrapper: wrap(checker) });
    await waitFor(() => expect(checker.check).toHaveBeenCalled());
    expect(result.current.state.kind).toBe("idle");
    expect(checker.installAndRelaunch).not.toHaveBeenCalled();
  });

  it("download failure surfaces error with lastInfo", async () => {
    const info = { version: "0.2.0", currentVersion: "0.1.0", notes: null, pubDate: null };
    const checker = makeChecker({
      check: vi.fn().mockResolvedValue(info),
      installAndRelaunch: vi.fn().mockRejectedValue(new Error("network down")),
    });
    const { result } = renderHook(() => useUpdater(), { wrapper: wrap(checker) });
    await waitFor(() => expect(result.current.state.kind).toBe("error"));
    if (result.current.state.kind === "error") {
      expect(result.current.state.lastInfo?.version).toBe("0.2.0");
    }
    act(() => result.current.dismissError());
    expect(result.current.state.kind).toBe("idle");
  });

  it("Skip persists skippedVersion", async () => {
    const info = { version: "0.2.0", currentVersion: "0.1.0", notes: null, pubDate: null };
    const checker = makeChecker({
      check: vi.fn().mockResolvedValue(info),
      installAndRelaunch: vi.fn(async (cb) => { cb({ downloaded: 1, total: 1 }); }),
    });
    const { result } = renderHook(() => useUpdater(), { wrapper: wrap(checker) });
    await waitFor(() => expect(result.current.state.kind).toBe("ready"));
    await act(async () => { await result.current.skip(); });
    const s = await browserSettings.load();
    expect(s.update.skippedVersion).toBe("0.2.0");
    expect(result.current.state.kind).toBe("idle");
  });

  it("Remind persists remindAfter ~24h ahead", async () => {
    const info = { version: "0.2.0", currentVersion: "0.1.0", notes: null, pubDate: null };
    const checker = makeChecker({
      check: vi.fn().mockResolvedValue(info),
      installAndRelaunch: vi.fn(async (cb) => { cb({ downloaded: 1, total: 1 }); }),
    });
    const { result } = renderHook(() => useUpdater(), { wrapper: wrap(checker) });
    await waitFor(() => expect(result.current.state.kind).toBe("ready"));
    const before = Date.now();
    await act(async () => { await result.current.remindLater(); });
    const s = await browserSettings.load();
    expect(s.update.remindAfter).not.toBeNull();
    expect(s.update.remindAfter! - before).toBeGreaterThan(23 * 60 * 60 * 1000);
  });

  it("manualCheck during download is a no-op", async () => {
    let resolveInstall: () => void = () => {};
    const info = { version: "0.2.0", currentVersion: "0.1.0", notes: null, pubDate: null };
    const checker = makeChecker({
      check: vi.fn().mockResolvedValue(info),
      installAndRelaunch: vi.fn(() => new Promise<void>((res) => { resolveInstall = res; })),
    });
    const { result } = renderHook(() => useUpdater(), { wrapper: wrap(checker) });
    await waitFor(() => expect(result.current.state.kind).toBe("downloading"));
    const before = (checker.check as any).mock.calls.length;
    await act(async () => { await result.current.manualCheck(); });
    expect((checker.check as any).mock.calls.length).toBe(before);
    resolveInstall();
  });

  it("translocated bundle puts state into error on launch", async () => {
    const checker = makeChecker({ isTranslocated: vi.fn().mockResolvedValue(true) });
    const { result } = renderHook(() => useUpdater(), { wrapper: wrap(checker) });
    await waitFor(() => expect(result.current.state.kind).toBe("error"));
    expect(checker.check).not.toHaveBeenCalled();
  });
});
