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

interface Props { tool: Tool; hideHeader?: boolean }

export function ToolTile({ tool, hideHeader }: Props) {
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
    <article className="border border-line rounded-[14px] bg-surface p-4 flex flex-col gap-2 shadow-1 animate-tile-in transition-[border-color,box-shadow,transform] duration-200 ease-(--ease-smooth) hover:border-line-hi hover:shadow-2">
      {!hideHeader && (
        <>
          <header className="flex items-center gap-2">
            <span className="text-[22px] leading-none flex-none">{tool.icon ?? "▸"}</span>
            <h3
              className="font-display text-[17px] font-semibold tracking-[-0.005em] text-ink flex-1 min-w-0 break-words leading-[1.25]"
              title={tool.name}
            >
              {tool.name}
            </h3>
            {status && (
              <span className="ml-auto"><RunStatusPill status={status} /></span>
            )}
          </header>
          {tool.description && (
            <p className="text-[13px] text-ink-3 leading-[1.5]">{tool.description}</p>
          )}
        </>
      )}
      {hideHeader && status && (
        <div className="flex justify-end"><RunStatusPill status={status} /></div>
      )}

      <div className="mt-1">
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
      </div>

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
    </article>
  );
}
