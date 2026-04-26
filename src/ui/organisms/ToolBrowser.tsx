import type { Tool } from "../../domain/tool";
import { ToolCard } from "./ToolCard";

interface Props {
  title: string;
  subtitle?: string;
  tools: Tool[];
  onPick: (id: string) => void;
  emptyHint?: string;
}

export function ToolBrowser({ title, subtitle, tools, onPick, emptyHint }: Props) {
  return (
    <div className="tool-browser">
      <header className="tool-browser__head">
        <h1 className="tool-browser__title">{title}</h1>
        {subtitle && <span className="tool-browser__sub">{subtitle}</span>}
      </header>

      {tools.length === 0 ? (
        <div className="tool-browser__empty">
          {emptyHint ?? "No tools match."}
        </div>
      ) : (
        <div className="tool-browser__grid">
          {tools.map(t => (
            <ToolCard key={t.id} tool={t} onClick={() => onPick(t.id)} />
          ))}
        </div>
      )}
    </div>
  );
}
