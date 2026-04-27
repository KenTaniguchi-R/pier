import { useEffect, useMemo, useRef, useState } from "react";
import type { Tool, Parameter, ParamValue } from "../domain/tool";
import { useApp } from "../state/AppContext";
import { useRunner } from "../state/RunnerContext";
import { buildArgs } from "./argTemplate";
import { findBlocker, blockerLabel } from "./runBlocker";

function defaultValue(p: Parameter): ParamValue {
  if (p.default !== undefined) return p.default;
  if (p.type === "boolean") return false;
  if (p.type === "select") return p.options[0] ?? "";
  return "";
}

function initialValues(tool: Tool): Record<string, ParamValue> {
  return Object.fromEntries((tool.parameters ?? []).map(p => [p.id, defaultValue(p)]));
}

export interface ToolRunController {
  values: Record<string, ParamValue>;
  setValue: (id: string, v: ParamValue) => void;

  isRunning: boolean;
  startedAt: number | null;
  canRun: boolean;
  blockedReason?: string;

  resolvedArgs: string[];
  confirmOpen: boolean;
  cancelConfirm: () => void;
  acceptConfirm: () => void;

  onRunClick: () => void;
  stopRun: () => void;
}

/**
 * Orchestrates a single tool's run lifecycle: param state, blocker computation,
 * confirm flow, runner port calls, and Cmd+Enter / Cmd+. shortcuts.
 *
 * UI-agnostic — returns plain values consumed by ToolDetail.
 */
export function useToolRun(tool: Tool): ToolRunController {
  const { state, dispatch } = useApp();
  const runner = useRunner();
  const [values, setValues] = useState<Record<string, ParamValue>>(() => initialValues(tool));
  const [confirmOpen, setConfirmOpen] = useState(false);

  const runId = state.selectedRunIdByTool[tool.id];
  const run = runId ? state.runs[runId] : undefined;
  const isRunning = run?.status === "running";
  const startedAt = run?.startedAt ?? null;
  const params = tool.parameters ?? [];

  const blocker = useMemo(() => findBlocker(params, values), [params, values]);
  const canRun = !blocker;
  const resolvedArgs = useMemo(() => buildArgs(tool, values), [tool, values]);

  const setValue = (id: string, v: ParamValue) =>
    setValues(prev => ({ ...prev, [id]: v }));

  const startRun = async (confirmed: boolean) => {
    const outcome = await runner.run(tool.id, values, confirmed);
    dispatch({ type: "RUN_STARTED", runId: outcome.runId, toolId: tool.id, startedAt: outcome.startedAt });
  };

  const stopRun = () => { if (runId) runner.kill(runId); };
  const onRunClick = () => (tool.confirm === false ? startRun(false) : setConfirmOpen(true));
  const cancelConfirm = () => setConfirmOpen(false);
  const acceptConfirm = () => { setConfirmOpen(false); startRun(true); };

  useRunShortcuts({
    canRun: !!canRun && !confirmOpen && !isRunning,
    isRunning: !!isRunning,
    onRun: onRunClick,
    onStop: stopRun,
  });

  return {
    values,
    setValue,
    isRunning: !!isRunning,
    startedAt,
    canRun,
    blockedReason: blocker ? blockerLabel(blocker) : undefined,
    resolvedArgs,
    confirmOpen,
    cancelConfirm,
    acceptConfirm,
    onRunClick,
    stopRun,
  };
}

/**
 * Window-level keyboard shortcuts for the tool runner:
 *   ⌘↵ — run when ready, ⌘. — stop when running.
 *
 * Ignored while typing in a textarea or during IME composition.
 * Single binding via a callback ref so handlers always see the latest state.
 */
function useRunShortcuts(opts: {
  canRun: boolean;
  isRunning: boolean;
  onRun: () => void;
  onStop: () => void;
}) {
  const optsRef = useRef(opts);
  optsRef.current = opts;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.metaKey || e.isComposing) return;
      const inTextarea = (e.target as HTMLElement | null)?.tagName === "TEXTAREA";
      const { canRun, isRunning, onRun, onStop } = optsRef.current;

      if (e.key === "Enter" && canRun && !inTextarea) {
        e.preventDefault();
        onRun();
      } else if (e.key === "." && isRunning) {
        e.preventDefault();
        onStop();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
