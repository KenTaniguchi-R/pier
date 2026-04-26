import type { Tool } from "../../domain/tool";

interface Props {
  tool: Tool;
  onClick: () => void;
}

export function ToolCard({ tool, onClick }: Props) {
  return (
    <button type="button" className="tool-card" onClick={onClick}>
      <span className="tool-card__icon" aria-hidden>{tool.icon ?? "▸"}</span>
      <span className="tool-card__body">
        <span className="tool-card__name">{tool.name}</span>
        {tool.description && <span className="tool-card__desc">{tool.description}</span>}
      </span>
    </button>
  );
}
