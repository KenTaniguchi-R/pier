import { useState } from "react";
import type { Tool } from "../../domain/tool";
import { Button } from "../atoms/Button";
import { TextField } from "../atoms/TextField";
import { Textarea } from "../atoms/Textarea";
import { DropZone } from "../molecules/DropZone";
import { ConfirmDialog } from "../molecules/ConfirmDialog";
import { useApp } from "../../state/AppContext";
import { useRunner } from "../../state/RunnerContext";

interface Props { tool: Tool }

export function ToolRunner({ tool }: Props) {
  const { state, dispatch } = useApp();
  const runner = useRunner();
  const [input, setInput] = useState<string | null>(null);
  const [latestRunId, setLatestRunId] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const status = latestRunId ? state.runs[latestRunId]?.status ?? null : null;
  const inputProvided = tool.inputType === "none" || (input !== null && input !== "");
  const canRun = inputProvided && status !== "running";

  const resolvedArgs = (tool.args ?? []).map(a => a.replace("{input}", input ?? ""));

  const startRun = async () => {
    const outcome = await runner.run({ toolId: tool.id, input }, tool);
    setLatestRunId(outcome.runId);
    dispatch({ type: "RUN_STARTED", runId: outcome.runId, toolId: tool.id, startedAt: outcome.startedAt });
    dispatch({ type: "SELECT_RUN", runId: outcome.runId });
  };

  const onRunClick = () => {
    if (tool.confirm === false) startRun();
    else setConfirmOpen(true);
  };

  return (
    <div className="flex flex-col gap-3 animate-tile-in">
      {tool.inputType === "file" && (
        <DropZone
          accepts={tool.accepts}
          onDrop={p => setInput(p)}
          label={input ? input.split("/").pop() : undefined}
        />
      )}
      {tool.inputType === "folder" && (
        <DropZone directory onDrop={p => setInput(p)} label={input ?? undefined} />
      )}
      {tool.inputType === "text" && (
        <Textarea value={input ?? ""} onChange={e => setInput(e.target.value)} placeholder="Paste text…" />
      )}
      {tool.inputType === "url" && (
        <TextField value={input ?? ""} onChange={e => setInput(e.target.value)} placeholder="https://…" />
      )}

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
