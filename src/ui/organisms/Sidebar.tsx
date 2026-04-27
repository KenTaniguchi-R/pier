import type { Tool } from "../../domain/tool";

export type Selection =
  | { kind: "all" }
  | { kind: "category"; name: string }
  | { kind: "tool"; id: string }
  | { kind: "help" };

interface Props {
  tools: Tool[];
  query: string;
  onQueryChange: (q: string) => void;
  selection: Selection;
  onSelect: (s: Selection) => void;
}

const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const ITEM_BASE =
  "relative flex items-center gap-2 w-full px-3 py-[9px] border border-transparent bg-transparent " +
  "rounded-[10px] cursor-pointer font-body font-medium text-[13px] leading-[1.2] text-left " +
  "transition-[background-color,color] duration-100 ease-(--ease-smooth) " +
  "hover:bg-surface hover:text-ink";

const ITEM_ACTIVE =
  "bg-surface text-ink border-line " +
  "before:content-[''] before:absolute before:-left-[3px] before:top-2 before:bottom-2 before:w-[3px] before:rounded-[2px] before:bg-accent";

export function Sidebar({ tools, query, onQueryChange, selection, onSelect }: Props) {
  const categories = Array.from(
    new Set(tools.map(t => t.category).filter((c): c is string => !!c))
  ).sort();

  const isAll = selection.kind === "all";
  const isHelp = selection.kind === "help";
  const selectedCat = selection.kind === "category" ? selection.name : null;

  return (
    <nav className="flex flex-col w-full h-full">
      <div className="flex-none px-3 pt-4 pb-2">
        <input
          className="w-full font-body font-normal text-[13px] leading-[1.4] bg-surface text-ink border border-line rounded-[10px] px-3 py-2 placeholder:text-ink-4 focus:outline-none focus:border-accent-edge focus:shadow-[0_0_0_4px_var(--color-accent-soft)] transition-[border-color,box-shadow] duration-200 ease-(--ease-smooth)"
          type="search"
          placeholder="Search tools…"
          value={query}
          onChange={e => onQueryChange(e.target.value)}
          aria-label="Search tools"
        />
      </div>

      <ul className="flex-1 list-none px-2 m-0 overflow-y-auto flex flex-col gap-[2px]">
        <li>
          <button
            type="button"
            className={`${ITEM_BASE} text-ink-2 ${isAll ? ITEM_ACTIVE : ""}`}
            onClick={() => onSelect({ kind: "all" })}
          >
            <span
              className={`flex-none w-[18px] text-center text-[14px] ${isAll ? "text-accent" : "text-ink-3"}`}
              aria-hidden
            >
              ⌂
            </span>
            <span className="flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
              All tools
            </span>
          </button>
        </li>

        {categories.length > 0 && (
          <li className="h-px bg-line mx-2 my-2" aria-hidden />
        )}

        {categories.map(c => {
          const active = selectedCat === c;
          return (
            <li key={c}>
              <button
                type="button"
                className={`${ITEM_BASE} text-ink-2 ${active ? ITEM_ACTIVE : ""}`}
                onClick={() => onSelect({ kind: "category", name: c })}
              >
                <span
                  className={`flex-none w-[18px] text-center text-[14px] ${active ? "text-accent" : "text-ink-3"}`}
                  aria-hidden
                >
                  ▸
                </span>
                <span className="flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
                  {titleCase(c)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="flex-none px-2 pt-2 pb-1 border-t border-line">
        <button
          type="button"
          className={`${ITEM_BASE} text-ink-2 ${isHelp ? ITEM_ACTIVE : ""}`}
          onClick={() => onSelect({ kind: "help" })}
        >
          <span
            className={`flex-none w-[18px] text-center text-[14px] ${isHelp ? "text-accent" : "text-ink-3"}`}
            aria-hidden
          >
            ?
          </span>
          <span className="flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
            Setup with Claude
          </span>
        </button>
      </div>

      <div className="flex-none px-4 py-2 border-t border-line">
        <span className="font-mono font-normal text-[11px] leading-[1.4] text-ink-4">
          ~/.pier/tools.json
        </span>
      </div>
    </nav>
  );
}
