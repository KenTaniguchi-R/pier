import { useState } from "react";
import type { Tool } from "../../domain/tool";
import type { RunStatus } from "../../domain/runRequest";
import { Button } from "../atoms/Button";
import { TextField } from "../atoms/TextField";
import { Textarea } from "../atoms/Textarea";
import { DropZone } from "../molecules/DropZone";
import { ConfirmDialog } from "../molecules/ConfirmDialog";
import { RunStatusPill } from "../molecules/RunStatusPill";
import { useApp } from "../../state/AppContext";
import { useRunner } from "../../state/RunnerContext";

interface Props { tool: Tool }

export function ToolTile({ tool }: Props) {
  const { state, dispatch } = useApp();
  const runner = useRunner();
  const [input, setInput] = useState<string | null>(null);
  const [latestRunId, setLatestRunId] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const run = state.runs[latestRunId ?? ""] ?? null;
  const status: RunStatus | null = run?.status ?? null;

  const resolvedArgs = (tool.args ?? []).map(a => a.replace("{input}", input ?? ""));
  const inputProvided = tool.inputType === "none" || (input !== null && input !== "");
  const canRun = inputProvided && status !== "running";

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
    <article className="tool-tile">
      <header className="tool-tile__head">
        <span className="tool-tile__icon">{tool.icon ?? "▸"}</span>
        <h3 className="tool-tile__name" title={tool.name}>{tool.name}</h3>
        {status && <span className="tool-tile__pill"><RunStatusPill status={status} /></span>}
      </header>
      {tool.description && <p className="tool-tile__desc">{tool.description}</p>}

      <div className="tool-tile__input">
        {tool.inputType === "file" && (
          <DropZone
            accepts={tool.accepts}
            onDrop={p => setInput(p)}
            label={input ? `// ${input.split("/").pop()}` : undefined}
          />
        )}
        {tool.inputType === "folder" && (
          <DropZone onDrop={p => setInput(p)} label={input ? `// ${input}` : "// DROP FOLDER"} />
        )}
        {tool.inputType === "text" && (
          <Textarea value={input ?? ""} onChange={e => setInput(e.target.value)} placeholder="Paste text…" />
        )}
        {tool.inputType === "url" && (
          <TextField value={input ?? ""} onChange={e => setInput(e.target.value)} placeholder="https://…" />
        )}
      </div>

      <footer className="tool-tile__foot">
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
    </article>
  );
}
