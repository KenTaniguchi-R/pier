import { useCallback, useEffect, useReducer, useRef } from "react";
import type { UpdateInfo, UpdateProgress, UpdateState } from "../domain/update";
import { AUTO_CHECK_INTERVAL_MS, dueForCheck, shouldSkip } from "../domain/update";
import { DEFAULT_UPDATE_PREFS, type UpdatePrefs } from "../domain/settings";
import { useUpdateChecker } from "../state/UpdaterContext";
import { useSettingsAdapter } from "../state/SettingsContext";

const POLL_MS = 15 * 60 * 1000;

export interface UpdateController {
  state: UpdateState;
  manualCheck: () => Promise<void>;
  install: () => Promise<void>;
  remindLater: () => Promise<void>;
  skip: () => Promise<void>;
  dismissError: () => void;
}

type Action =
  | { type: "set"; state: UpdateState }
  | { type: "progress"; progress: UpdateProgress };

function reducer(prev: UpdateState, a: Action): UpdateState {
  if (a.type === "set") return a.state;
  if (a.type === "progress" && prev.kind === "downloading") return { ...prev, progress: a.progress };
  return prev;
}

export function useUpdater(): UpdateController {
  const checker = useUpdateChecker();
  const settings = useSettingsAdapter();
  const [state, dispatch] = useReducer(reducer, { kind: "idle" } as UpdateState);
  const stateRef = useRef<UpdateState>(state);
  stateRef.current = state;
  const prefsRef = useRef<UpdatePrefs>(DEFAULT_UPDATE_PREFS);

  const isBusy = useCallback(
    () => stateRef.current.kind === "checking" || stateRef.current.kind === "downloading",
    [],
  );

  const runFlow = useCallback(
    async (opts: { manual: boolean }) => {
      if (isBusy()) return;
      dispatch({ type: "set", state: { kind: "checking" } });
      try {
        const info = await checker.check();
        const merged = await settings.patch({ update: { lastCheckedAt: Date.now() } });
        prefsRef.current = merged.update;
        if (!info) { dispatch({ type: "set", state: { kind: "idle" } }); checker.setTrayBadge(false); return; }
        if (!opts.manual && shouldSkip(info, merged.update, Date.now())) {
          dispatch({ type: "set", state: { kind: "idle" } }); checker.setTrayBadge(false); return;
        }
        if (!merged.update.autoCheck && !opts.manual) {
          dispatch({ type: "set", state: { kind: "available", info } }); return;
        }
        dispatch({ type: "set", state: { kind: "downloading", info, progress: { downloaded: 0, total: null } } });
        try {
          await checker.installAndRelaunch((p) => dispatch({ type: "progress", progress: p }));
          dispatch({ type: "set", state: { kind: "ready", info } });
          checker.setTrayBadge(true);
          checker.notifyReady(info.version);
        } catch (err) {
          dispatch({ type: "set", state: { kind: "error", message: String(err), lastInfo: info } });
        }
      } catch (err) {
        dispatch({ type: "set", state: { kind: "error", message: String(err), lastInfo: null } });
      }
    },
    [checker, settings, isBusy],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const translocated = await checker.isTranslocated();
        if (cancelled) return;
        if (translocated) {
          dispatch({ type: "set", state: {
            kind: "error",
            message: "Move Pier to /Applications and reopen to enable updates.",
            lastInfo: null,
          }});
          return;
        }
        const s = await settings.load();
        if (cancelled) return;
        prefsRef.current = s.update;
        if (dueForCheck(s.update, Date.now())) await runFlow({ manual: false });
      } catch {/* swallow boot errors */}
    })();
    return () => { cancelled = true; };
  }, [checker, settings, runFlow]);

  useEffect(() => {
    const tick = async () => {
      if (isBusy()) return;
      const s = await settings.load();
      prefsRef.current = s.update;
      if (dueForCheck(s.update, Date.now())) await runFlow({ manual: false });
    };
    const onFocus = () => { void tick(); };
    const interval = setInterval(() => { void tick(); }, POLL_MS);
    if (typeof window !== "undefined") window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(interval);
      if (typeof window !== "undefined") window.removeEventListener("focus", onFocus);
    };
  }, [settings, runFlow, isBusy]);

  const manualCheck = useCallback(async () => { await runFlow({ manual: true }); }, [runFlow]);

  const install = useCallback(async () => {
    const cur = stateRef.current;
    if (cur.kind !== "ready" && cur.kind !== "available") return;
    const info = (cur as { info: UpdateInfo }).info;
    dispatch({ type: "set", state: { kind: "downloading", info, progress: { downloaded: 0, total: null } } });
    try {
      await checker.installAndRelaunch((p) => dispatch({ type: "progress", progress: p }));
      dispatch({ type: "set", state: { kind: "ready", info } });
      checker.setTrayBadge(true);
      checker.notifyReady(info.version);
    } catch (err) {
      dispatch({ type: "set", state: { kind: "error", message: String(err), lastInfo: info } });
    }
  }, [checker]);

  const skip = useCallback(async () => {
    const cur = stateRef.current;
    const info = "info" in cur ? (cur as { info?: UpdateInfo }).info ?? null : null;
    if (!info) { dispatch({ type: "set", state: { kind: "idle" } }); checker.setTrayBadge(false); return; }
    await settings.patch({ update: { skippedVersion: info.version } });
    dispatch({ type: "set", state: { kind: "idle" } });
    checker.setTrayBadge(false);
  }, [settings, checker]);

  const remindLater = useCallback(async () => {
    await settings.patch({ update: { remindAfter: Date.now() + AUTO_CHECK_INTERVAL_MS } });
    dispatch({ type: "set", state: { kind: "idle" } });
    checker.setTrayBadge(false);
  }, [settings, checker]);

  const dismissError = useCallback(() => {
    dispatch({ type: "set", state: { kind: "idle" } });
    checker.setTrayBadge(false);
  }, [checker]);

  return { state, manualCheck, install, remindLater, skip, dismissError };
}
