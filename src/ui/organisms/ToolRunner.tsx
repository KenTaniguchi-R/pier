import { useState } from "react";
import type { Tool, Parameter, ParamValue } from "../../domain/tool";
import { Button } from "../atoms/Button";
import { ParamField } from "../molecules/ParamField";
import { ConfirmDialog } from "../molecules/ConfirmDialog";
import { useApp } from "../../state/AppContext";
import { useRunner } from "../../state/RunnerContext";
import { buildArgs } from "../../application/argTemplate";

interface Props { tool: Tool }

function defaultValue(p: Parameter): ParamValue {
  if (p.default !== undefined) return p.default;
  if (p.type === "boolean") return false;
  if (p.type === "select") return p.options[0] ?? "";
  return "";
}

function initialValues(tool: Tool): Record<string, ParamValue> {
  return Object.fromEntries((tool.parameters ?? []).map(p => [p.id, defaultValue(p)]));
}

function isFilled(v: ParamValue | undefined): boolean {
  if (typeof v === "string") return v !== "";
  return v !== undefined && v !== null;
}

export function ToolRunner({ tool }: Props) {
  const { state, dispatch } = useApp();
  const runner = useRunner();
  const [values, setValues] = useState<Record<string, ParamValue>>(() => initialValues(tool));
  const [confirmOpen, setConfirmOpen] = useState(false);

  const runId = state.selectedRunIdByTool[tool.id];
  const status = runId ? state.runs[runId]?.status ?? null : null;
  const params = tool.parameters ?? [];
  const canRun =
    status !== "running" &&
    params.every(p => p.optional === true || isFilled(values[p.id]));

  const resolvedArgs = buildArgs(tool, values);

  const startRun = async () => {
    const outcome = await runner.run({ toolId: tool.id, values }, tool);
    dispatch({ type: "RUN_STARTED", runId: outcome.runId, toolId: tool.id, startedAt: outcome.startedAt });
  };

  const onRunClick = () => (tool.confirm === false ? startRun() : setConfirmOpen(true));
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
