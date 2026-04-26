import { useEffect, useCallback, useState, useMemo } from "react";
import { useApp } from "../../state/AppContext";
import { useRunner } from "../../state/RunnerContext";
import { AppShell } from "../templates/AppShell";
import { Sidebar, type Selection } from "../organisms/Sidebar";
import { ToolBrowser } from "../organisms/ToolBrowser";
import { ToolDetail } from "../organisms/ToolDetail";
import { loadConfig } from "../../application/loadConfig";
import { tauriConfigLoader } from "../../infrastructure/tauriConfigLoader";
import type { Tool } from "../../domain/tool";

const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function matchesQuery(tool: Tool, q: string): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  return (
    tool.name.toLowerCase().includes(needle) ||
    (tool.description ?? "").toLowerCase().includes(needle) ||
    (tool.category ?? "").toLowerCase().includes(needle)
  );
}

export function HomePage() {
  const { state, dispatch } = useApp();
  const runner = useRunner();
  const [query, setQuery] = useState("");
  const [selection, setSelection] = useState<Selection>({ kind: "all" });

  const reload = useCallback(async () => {
    try {
      const r = await loadConfig(tauriConfigLoader);
      if (r.ok) dispatch({ type: "CONFIG_LOADED", tools: r.value.tools });
      else dispatch({ type: "CONFIG_ERROR", errors: r.errors });
    } catch (err) {
      dispatch({ type: "CONFIG_ERROR", errors: [String(err)] });
    }
  }, [dispatch]);

  useEffect(() => { reload(); }, [reload]);

  useEffect(() => {
    const off = tauriConfigLoader.watch(() => { reload(); });
    return off;
  }, [reload]);

  useEffect(() => {
    const offOut = runner.onOutput((runId, line, stream) =>
      dispatch({ type: "RUN_OUTPUT", runId, line, stream })
    );
    const offExit = runner.onExit((runId, o) =>
      dispatch({ type: "RUN_EXIT", runId, status: o.status, exitCode: o.exitCode, endedAt: o.endedAt ?? 0 })
    );
    return () => { offOut(); offExit(); };
  }, [runner, dispatch]);

  const tools = state.tools;

  const filteredTools = useMemo(() => {
    const q = query.trim();
    if (selection.kind === "tool") return tools;
    let pool = tools;
    if (selection.kind === "category") {
      pool = pool.filter(t => t.category === selection.name);
    }
    return pool.filter(t => matchesQuery(t, q));
  }, [tools, query, selection]);

  const selectedTool =
    selection.kind === "tool" ? tools.find(t => t.id === selection.id) ?? null : null;

  const browserTitle =
    selection.kind === "all" ? "All tools" :
    selection.kind === "category" ? titleCase(selection.name) : "";
  const browserSub =
    query.trim()
      ? `${filteredTools.length} match${filteredTools.length === 1 ? "" : "es"}`
      : `${filteredTools.length} tool${filteredTools.length === 1 ? "" : "s"}`;

  let main;
  if (state.configErrors.length) {
    main = (
      <div className="p-6 px-8 flex flex-col gap-3 text-danger">
        <h1 className="font-display text-[28px] font-bold tracking-[-0.01em] leading-[1.1] text-ink">
          Couldn't load your tools
        </h1>
        <ul className="list-none text-[13px] text-ink-2 mt-2">
          {state.configErrors.map((e, i) => (
            <li key={i} className="before:content-['•_'] before:text-danger">{e}</li>
          ))}
        </ul>
      </div>
    );
  } else if (selectedTool) {
    main = (
      <ToolDetail
        tool={selectedTool}
        onBack={() => setSelection({ kind: "all" })}
      />
    );
  } else {
    main = (
      <ToolBrowser
        title={browserTitle}
        subtitle={browserSub}
        tools={filteredTools}
        onPick={(id) => setSelection({ kind: "tool", id })}
        emptyHint={
          tools.length === 0
            ? "No tools yet. Edit ~/.pier/tools.json to add one."
            : "No tools match your search."
        }
      />
    );
  }

  return (
    <AppShell
      sidebar={
        <Sidebar
          tools={tools}
          query={query}
          onQueryChange={setQuery}
          selection={selection}
          onSelect={(s) => setSelection(s)}
        />
      }
      main={main}
    />
  );
}
