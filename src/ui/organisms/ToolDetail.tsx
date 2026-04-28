import type { Tool } from "../../domain/tool";
import { ToolDetailHeader } from "../molecules/ToolDetailHeader";
import { ConfirmDialog } from "../molecules/ConfirmDialog";
import { RunActionBar } from "../molecules/RunActionBar";
import { ToolRunner } from "./ToolRunner";
import { LogPanel } from "./LogPanel";
import { HistoryList } from "./HistoryList";
import { useCollapseOnScroll } from "./useCollapseOnScroll";
import { useToolRun } from "../../application/useToolRun";

interface Props {
  tool: Tool;
  onBack: () => void;
}

export function ToolDetail({ tool, onBack }: Props) {
  const { headerRef, scrollRef, collapsed } = useCollapseOnScroll<HTMLElement, HTMLDivElement>(tool.id);
  const run = useToolRun(tool);
  const params = tool.parameters ?? [];

  return (
    <div className="flex flex-col h-full">
      <ToolDetailHeader ref={headerRef} tool={tool} collapsed={collapsed} onBack={onBack} />

      <div ref={scrollRef} className="flex-1 flex flex-col min-h-0 px-10 py-6 gap-6 overflow-y-auto">
        <section className="flex-none">
          <ToolRunner params={params} values={run.values} errors={run.errors} onChange={run.setValue} />
        </section>

        <div className="flex items-center gap-3 flex-none">
          <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink-3">
            Output
          </span>
          <span className="flex-1 h-px bg-line" />
        </div>

        <section className="flex-1 min-h-[260px] flex [&>*]:w-full">
          <LogPanel toolId={tool.id} />
        </section>

        <HistoryList toolId={tool.id} />
      </div>

      <RunActionBar
        running={run.isRunning}
        startedAt={run.startedAt}
        canRun={run.canRun}
        blockedReason={run.blockedReason}
        onRun={run.onRunClick}
        onStop={run.stopRun}
      />

      <ConfirmDialog
        open={run.confirmOpen}
        toolName={tool.name}
        command={tool.command}
        args={run.resolvedArgs}
        shell={tool.shell ?? false}
        onCancel={run.cancelConfirm}
        onConfirm={run.acceptConfirm}
      />
    </div>
  );
}
