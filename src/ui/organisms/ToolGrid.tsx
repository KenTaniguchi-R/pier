import { useApp } from "../../state/AppContext";
import { ToolTile } from "./ToolTile";
import type { Tool } from "../../domain/tool";

function groupByCategory(tools: Tool[]): { category: string | null; tools: Tool[] }[] {
  const groups = new Map<string | null, Tool[]>();
  tools.forEach(t => {
    const k = t.category ?? null;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(t);
  });
  return Array.from(groups.entries()).map(([category, tools]) => ({ category, tools }));
}

export function ToolGrid() {
  const { state } = useApp();

  if (state.configErrors.length) {
    return (
      <div className="tool-grid tool-grid--errors">
        <div className="tool-grid__eyebrow">Couldn't load your tools</div>
        <ul>{state.configErrors.map((e, i) => <li key={i}>{e}</li>)}</ul>
      </div>
    );
  }

  if (!state.tools.length) {
    return (
      <div className="tool-grid tool-grid--empty">
        <span className="tool-grid__hint">No tools yet</span>
        <span className="tool-grid__sub">Ask Claude to add your first tool, or edit ~/.pier/tools.json</span>
      </div>
    );
  }

  const groups = groupByCategory(state.tools);
  const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  return (
    <div className="tool-grid">
      {groups.map(g => (
        <div key={g.category ?? "_"} className="tool-grid__group">
          {g.category && <div className="tool-grid__divider">{titleCase(g.category)}</div>}
          {g.tools.map(t => <ToolTile key={t.id} tool={t} />)}
        </div>
      ))}
    </div>
  );
}
