import { useEffect, useMemo, useRef, useState } from "react";
import { Home, HelpCircle, Library as LibraryIcon, Settings as SettingsIcon } from "lucide-react";
import type { Tool } from "../../domain/tool";
import type { RunningEntry } from "../../state/reducer";
import { SidebarItem } from "../molecules/SidebarItem";
import { SidebarCategoryGroup } from "../molecules/SidebarCategoryGroup";
import { SidebarRunningRow } from "../molecules/SidebarRunningRow";
import { useNow } from "../molecules/elapsed";

export type LibrarySelection =
  | { kind: "library"; view: "landing" }
  | { kind: "library"; view: "all" }
  | { kind: "library"; view: "detail"; toolId: string };

export type Selection =
  | { kind: "all" }
  | { kind: "category"; name: string }
  | { kind: "tool"; id: string }
  | { kind: "help" }
  | LibrarySelection
  | { kind: "settings" };

interface Props {
  tools: Tool[];
  query: string;
  onQueryChange: (q: string) => void;
  selection: Selection;
  onSelect: (s: Selection) => void;
  running?: RunningEntry[];
}

const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const STORAGE_KEY = "pier:sidebar:expanded";

function loadPersisted(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? new Set(arr.filter((x): x is string => typeof x === "string")) : new Set();
  } catch {
    return new Set();
  }
}

function persist(s: Set<string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...s]));
  } catch {
    // noop — sandboxed contexts
  }
}

export function Sidebar({ tools, query, onQueryChange, selection, onSelect, running = [] }: Props) {
  const now = useNow(running.length > 0);

  const toolById = useMemo(() => {
    const m = new Map<string, Tool>();
    for (const t of tools) m.set(t.id, t);
    return m;
  }, [tools]);

  const categories = useMemo(
    () =>
      Array.from(
        new Set(tools.map(t => t.category).filter((c): c is string => !!c))
      ).sort(),
    [tools]
  );

  const [expanded, setExpanded] = useState<Set<string>>(loadPersisted);
  const userCollapsedThisSession = useRef<Set<string>>(new Set());
  const didColdLaunchExpand = useRef(false);

  // Cold-launch: auto-expand the parent of the active tool, once.
  useEffect(() => {
    if (didColdLaunchExpand.current) return;
    if (selection.kind !== "tool") return;
    const tool = tools.find(t => t.id === selection.id);
    if (!tool?.category) return;
    didColdLaunchExpand.current = true;
    setExpanded(prev => {
      if (prev.has(tool.category!)) return prev;
      const next = new Set(prev);
      next.add(tool.category!);
      persist(next);
      return next;
    });
  }, [selection, tools]);

  // Within-session: auto-expand parent of newly selected tool, unless user
  // explicitly collapsed it this session.
  useEffect(() => {
    if (selection.kind !== "tool") return;
    const tool = tools.find(t => t.id === selection.id);
    if (!tool?.category) return;
    if (userCollapsedThisSession.current.has(tool.category)) return;
    setExpanded(prev => {
      if (prev.has(tool.category!)) return prev;
      const next = new Set(prev);
      next.add(tool.category!);
      persist(next);
      return next;
    });
  }, [selection, tools]);

  const toggleCategory = (cat: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(cat)) {
        next.delete(cat);
        userCollapsedThisSession.current.add(cat);
      } else {
        next.add(cat);
        userCollapsedThisSession.current.delete(cat);
      }
      persist(next);
      return next;
    });
    onSelect({ kind: "category", name: cat });
  };

  const isAll = selection.kind === "all";
  const isHelp = selection.kind === "help";
  const isLibrary = selection.kind === "library";
  const isSettings = selection.kind === "settings";
  const selectedCat = selection.kind === "category" ? selection.name : null;
  const activeToolId = selection.kind === "tool" ? selection.id : null;

  const toolsByCategory = useMemo(() => {
    const m = new Map<string, Tool[]>();
    for (const t of tools) {
      if (!t.category) continue;
      const list = m.get(t.category) ?? [];
      list.push(t);
      m.set(t.category, list);
    }
    for (const list of m.values()) list.sort((a, b) => a.name.localeCompare(b.name));
    return m;
  }, [tools]);

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
        {running.length > 0 && (
          <>
            <li className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-[0.08em] font-semibold text-ink-4 animate-tile-in">
              Running <span className="text-ink-3">({running.length})</span>
            </li>
            {running.map(entry => {
              const tool = toolById.get(entry.toolId);
              if (!tool) return null;
              const active = selection.kind === "tool" && selection.id === entry.toolId;
              return (
                <li key={entry.runId}>
                  <SidebarRunningRow
                    label={tool.name}
                    startedAt={entry.startedAt}
                    now={now}
                    active={active}
                    onClick={() => onSelect({ kind: "tool", id: entry.toolId })}
                  />
                </li>
              );
            })}
            <li className="h-px bg-line mx-2 my-2" aria-hidden />
          </>
        )}

        <li>
          <SidebarItem
            icon={<Home size={14} strokeWidth={2} />}
            label="All tools"
            active={isAll}
            onClick={() => onSelect({ kind: "all" })}
          />
        </li>

        {categories.length > 0 && (
          <li className="h-px bg-line mx-2 my-2" aria-hidden />
        )}

        {categories.map(c => (
          <SidebarCategoryGroup
            key={c}
            category={c}
            label={titleCase(c)}
            tools={toolsByCategory.get(c) ?? []}
            expanded={expanded.has(c)}
            categoryActive={selectedCat === c}
            activeToolId={activeToolId}
            onToggle={() => toggleCategory(c)}
            onPickTool={id => onSelect({ kind: "tool", id })}
          />
        ))}
      </ul>

      <div className="flex-none px-2 pt-2 pb-1 border-t border-line flex flex-col gap-[2px]">
        <SidebarItem
          icon={<LibraryIcon size={14} strokeWidth={2} />}
          label="Library"
          active={isLibrary}
          onClick={() => onSelect({ kind: "library", view: "landing" })}
        />
        <div className="h-px bg-line mx-2 my-1" aria-hidden />
        <SidebarItem
          icon={<HelpCircle size={14} strokeWidth={2} />}
          label="Setup with Claude"
          active={isHelp}
          onClick={() => onSelect({ kind: "help" })}
        />
        <SidebarItem
          icon={<SettingsIcon size={14} strokeWidth={2} />}
          label="Settings"
          active={isSettings}
          onClick={() => onSelect({ kind: "settings" })}
        />
      </div>

      <div className="flex-none px-4 py-2 border-t border-line">
        <span className="font-mono font-normal text-[11px] leading-[1.4] text-ink-4">
          ~/.pier/tools.json
        </span>
      </div>
    </nav>
  );
}
