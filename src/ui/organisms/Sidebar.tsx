import type { Tool } from "../../domain/tool";

export type Selection =
  | { kind: "all" }
  | { kind: "category"; name: string }
  | { kind: "tool"; id: string };

interface Props {
  tools: Tool[];
  query: string;
  onQueryChange: (q: string) => void;
  selection: Selection;
  onSelect: (s: Selection) => void;
}

const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function Sidebar({ tools, query, onQueryChange, selection, onSelect }: Props) {
  const categories = Array.from(
    new Set(tools.map(t => t.category).filter((c): c is string => !!c))
  ).sort();

  const isAll = selection.kind === "all";
  const selectedCat = selection.kind === "category" ? selection.name : null;

  return (
    <nav className="sidebar">
      <div className="sidebar__search">
        <input
          className="sidebar__search-input"
          type="search"
          placeholder="Search tools…"
          value={query}
          onChange={e => onQueryChange(e.target.value)}
          aria-label="Search tools"
        />
      </div>

      <ul className="sidebar__list">
        <li>
          <button
            type="button"
            className={`sidebar__item${isAll ? " sidebar__item--active" : ""}`}
            onClick={() => onSelect({ kind: "all" })}
          >
            <span className="sidebar__item-icon" aria-hidden>⌂</span>
            <span className="sidebar__item-label">All tools</span>
          </button>
        </li>

        {categories.length > 0 && <li className="sidebar__sep" aria-hidden />}

        {categories.map(c => (
          <li key={c}>
            <button
              type="button"
              className={`sidebar__item${selectedCat === c ? " sidebar__item--active" : ""}`}
              onClick={() => onSelect({ kind: "category", name: c })}
            >
              <span className="sidebar__item-icon" aria-hidden>▸</span>
              <span className="sidebar__item-label">{titleCase(c)}</span>
            </button>
          </li>
        ))}
      </ul>

      <div className="sidebar__foot">
        <span className="sidebar__foot-hint">~/.pier/tools.json</span>
      </div>
    </nav>
  );
}
