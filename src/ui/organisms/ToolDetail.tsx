import type { Tool } from "../../domain/tool";
import { ToolRunner } from "./ToolRunner";
import { LogPanel } from "./LogPanel";

interface Props {
  tool: Tool;
  onBack: () => void;
}

export function ToolDetail({ tool, onBack }: Props) {
  const params = tool.parameters ?? [];
  const inputSummary =
    params.length === 0 ? "no input"
    : params.length === 1 ? `accepts ${params[0].type}`
    : `${params.length} parameters`;
  const eyebrow = tool.category ?? inputSummary;

  return (
    <div className="flex flex-col h-full">
      <header className="flex-none px-10 pt-5 pb-6 border-b border-line">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to tools"
          className="bg-transparent border-none p-0 mb-4 font-body font-medium text-[12px] leading-none text-ink-3 cursor-pointer hover:text-ink"
        >
          ← All tools
        </button>
        <div className="flex items-baseline gap-3 mb-2">
          {tool.icon && (
            <span className="text-[22px] leading-none translate-y-[2px]">{tool.icon}</span>
          )}
          <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink-3">
            {eyebrow}
          </span>
        </div>
        <h1 className="font-display text-[34px] font-semibold tracking-[-0.02em] leading-[1.05] text-ink">
          {tool.name}
        </h1>
        {tool.description && (
          <p className="mt-3 font-display italic text-[16px] leading-[1.45] text-ink-2 max-w-[58ch]">
            {tool.description}
          </p>
        )}
      </header>

      <div className="flex-1 flex flex-col min-h-0 px-10 py-6 gap-6 overflow-y-auto">
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
