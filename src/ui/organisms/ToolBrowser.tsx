import type { Tool } from "../../domain/tool";
import { ToolCard } from "./ToolCard";

interface Props {
  title: string;
  subtitle?: string;
  tools: Tool[];
  onPick: (id: string) => void;
  emptyHint: string;
  runningToolIds?: ReadonlySet<string>;
}

export function ToolBrowser({ title, subtitle, tools, onPick, emptyHint, runningToolIds }: Props) {
  return (
    <div className="p-6 px-8 flex flex-col gap-4">
      <header className="flex items-baseline gap-2 pb-3 border-b border-line">
        <h1 className="font-display text-[28px] font-bold tracking-[-0.01em] leading-[1.1] text-ink">
          {title}
        </h1>
        {subtitle && (
          <span className="font-body font-medium text-[12px] leading-none text-ink-3">
            {subtitle}
          </span>
        )}
      </header>

      {tools.length === 0 && (
        <div className="p-4 text-center text-ink-3 text-[14px]">
          {emptyHint}
        </div>
      )}
      <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(280px,1fr))]">
        {tools.map(t => (
          <ToolCard
            key={t.id}
            tool={t}
            onClick={() => onPick(t.id)}
            running={runningToolIds?.has(t.id) ?? false}
          />
        ))}
      </div>
    </div>
  );
}
