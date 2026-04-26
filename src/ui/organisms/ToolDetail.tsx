import type { Tool } from "../../domain/tool";
import { ToolTile } from "./ToolTile";
import { LogPanel } from "./LogPanel";

interface Props {
  tool: Tool;
  onBack: () => void;
}

export function ToolDetail({ tool, onBack }: Props) {
  return (
    <div className="tool-detail">
      <header className="tool-detail__head">
        <button type="button" className="tool-detail__back" onClick={onBack} aria-label="Back to tools">
          ← All tools
        </button>
        <h1 className="tool-detail__title">{tool.name}</h1>
        {tool.description && <span className="tool-detail__sub">{tool.description}</span>}
      </header>

      <div className="tool-detail__body">
        <section className="tool-detail__card">
          <ToolTile tool={tool} hideHeader />
        </section>
        <section className="tool-detail__output">
          <LogPanel />
        </section>
      </div>
    </div>
  );
}
