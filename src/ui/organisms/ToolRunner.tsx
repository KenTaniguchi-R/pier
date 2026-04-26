import { useState } from "react";
import type { Tool, ParamValue } from "../../domain/tool";
import { Button } from "../atoms/Button";
import { ParamField } from "../molecules/ParamField";
import { ConfirmDialog } from "../molecules/ConfirmDialog";
import { useApp } from "../../state/AppContext";
import { useRunner } from "../../state/RunnerContext";
import { buildArgs } from "../../application/argTemplate";

interface Props { tool: Tool }

function initialValues(tool: Tool): Record<string, ParamValue> {
  const out: Record<string, ParamValue> = {};
  for (const p of tool.parameters ?? []) {
    if (p.default !== undefined) out[p.id] = p.default;
    else if (p.type === "boolean") out[p.id] = false;
    else if (p.type === "select") out[p.id] = p.options[0] ?? "";
    else out[p.id] = "";
  }
  return out;
}

function isFilled(v: ParamValue | undefined): boolean {
  if (v === undefined || v === null) return false;
  if (typeof v === "string") return v !== "";
  return true;
}

export function ToolRunner({ tool }: Props) {
  const { state, dispatch } = useApp();
  const runner = useRunner();
  const [values, setValues] = useState<Record<string, ParamValue>>(() => initialValues(tool));
  const [latestRunId, setLatestRunId] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const status = latestRunId ? state.runs[latestRunId]?.status ?? null : null;
  const params = tool.parameters ?? [];
  const allRequiredFilled = params.every(p => p.optional === true || isFilled(values[p.id]));
  const canRun = allRequiredFilled && status !== "running";

  const resolvedArgs = buildArgs(tool, values);

  const startRun = async () => {
    const outcome = await runner.run({ toolId: tool.id, values }, tool);
    setLatestRunId(outcome.runId);
    dispatch({ type: "RUN_STARTED", runId: outcome.runId, toolId: tool.id, startedAt: outcome.startedAt });
  };

  const onRunClick = () => {
    if (tool.confirm === false) startRun();
    else setConfirmOpen(true);
  };

  const setValue = (id: string, v: ParamValue) => setValues(prev => ({ ...prev, [id]: v }));

  return (
    <div className="flex flex-col gap-7">
      {params.map((p, i) => (
        <ParamField
          key={p.id}
          param={p}
          index={i}
          value={values[p.id]}
          onChange={v => setValue(p.id, v)}
        />
      ))}

      {params.length > 0 && <span className="block h-px bg-line mt-1" />}

      <footer className="flex justify-end">
        <Button variant="primary" disabled={!canRun} onClick={onRunClick}>Run</Button>
      </footer>

      <ConfirmDialog
        open={confirmOpen}
        toolName={tool.name}
        command={tool.command}
        args={resolvedArgs}
        shell={tool.shell ?? false}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => { setConfirmOpen(false); startRun(); }}
      />
    </div>
  );
}
