import type { Tool } from "../../domain/tool";
import { ToolDetailHeader } from "../molecules/ToolDetailHeader";
import { ToolRunner } from "./ToolRunner";
import { LogPanel } from "./LogPanel";
import { useCollapseOnScroll } from "./useCollapseOnScroll";

interface Props {
  tool: Tool;
  onBack: () => void;
}

export function ToolDetail({ tool, onBack }: Props) {
  const { headerRef, scrollRef, collapsed } = useCollapseOnScroll<HTMLElement, HTMLDivElement>(tool.id);

  return (
    <div className="flex flex-col h-full">
      <ToolDetailHeader ref={headerRef} tool={tool} collapsed={collapsed} onBack={onBack} />

      <div ref={scrollRef} className="flex-1 flex flex-col min-h-0 px-10 py-6 gap-6 overflow-y-auto">
        <section className="flex-none">
          <ToolRunner tool={tool} />
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
      </div>
    </div>
  );
}
