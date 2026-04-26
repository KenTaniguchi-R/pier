import type { Tool } from "../../domain/tool";
import { ToolTile } from "./ToolTile";
import { LogPanel } from "./LogPanel";

interface Props {
  tool: Tool;
  onBack: () => void;
}

export function ToolDetail({ tool, onBack }: Props) {
  return (
    <div className="flex flex-col h-full">
      <header className="flex-none px-8 pt-4 pb-3 border-b border-line flex flex-col gap-1">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to tools"
          className="self-start bg-transparent border-none p-0 mb-1 font-body font-medium text-[12px] leading-none text-ink-3 cursor-pointer hover:text-ink"
        >
          ← All tools
        </button>
        <h1 className="font-display text-[24px] font-bold tracking-[-0.01em] leading-[1.15] text-ink">
          {tool.name}
        </h1>
        {tool.description && (
          <span className="text-[13px] text-ink-3">{tool.description}</span>
        )}
      </header>

      <div className="flex-1 grid gap-4 px-8 py-4 min-h-0 grid-cols-1 [@media(min-width:900px)]:grid-cols-[minmax(320px,420px)_1fr]">
        <section className="min-w-0">
          <ToolTile tool={tool} hideHeader />
        </section>
        <section className="min-w-0 border border-line rounded-[14px] bg-surface overflow-hidden flex [&>*]:w-full">
          <LogPanel />
        </section>
      </div>
    </div>
  );
}
