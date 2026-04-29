import { useEffect, useCallback, useState, useMemo } from "react";
import { useApp } from "../../state/AppContext";
import { useRunner } from "../../state/RunnerContext";
import { AppShell } from "../templates/AppShell";
import { Sidebar, type Selection } from "../organisms/Sidebar";
import { HomeAllTools } from "../organisms/HomeAllTools";
import { ToolDetail } from "../organisms/ToolDetail";
import { SkillGuide } from "../organisms/SkillGuide";
import { LibraryLandingPage } from "./LibraryLandingPage";
import { LibraryAllPage } from "./LibraryAllPage";
import { LibraryToolDetailPage } from "./LibraryToolDetailPage";
import { useCatalog, useAddTool, useRemoveTool } from "../../application/useLibrary";
import type { CatalogTool } from "../../domain/library";
import { SettingsPage } from "./SettingsPage";
import { loadConfig } from "../../application/loadConfig";
import { tauriConfigLoader } from "../../infrastructure/tauriConfigLoader";
import { runningRuns, runningToolIds } from "../../state/reducer";
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
      if (r.ok) dispatch({ type: "CONFIG_LOADED", tools: r.value.tools, defaults: r.value.defaults });
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
    const offOut = runner.onOutput((runId, line, stream, transient) =>
      dispatch({ type: "RUN_OUTPUT", runId, line, stream, transient })
    );
    const offExit = runner.onExit((runId, o) =>
      dispatch({ type: "RUN_EXIT", runId, status: o.status, exitCode: o.exitCode, endedAt: o.endedAt ?? 0 })
    );
    return () => { offOut(); offExit(); };
  }, [runner, dispatch]);

  const tools = state.tools;
  const running = useMemo(() => runningRuns(state), [state]);
  const runningIds = useMemo(() => runningToolIds(state), [state]);

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

  const { catalog } = useCatalog();
  const { previewAdd, commit: commitAdd, busy: addBusy } = useAddTool();
  const { remove: commitRemove, busy: removeBusy } = useRemoveTool();
  const installedIds = useMemo(() => new Set(state.tools.map(t => t.id)), [state.tools]);

  const [detailPreview, setDetailPreview] = useState<{ toolId: string; previewJson: string } | null>(null);

  useEffect(() => {
    if (selection.kind !== "library" || selection.view !== "detail") {
      setDetailPreview(null);
      return;
    }
    const id = selection.toolId;
    if (detailPreview?.toolId === id) return;
    const tool = catalog?.tools.find(t => t.id === id);
    if (!tool) return;
    let cancelled = false;
    previewAdd(tool).then(p => {
      if (!cancelled) setDetailPreview({ toolId: id, previewJson: p.after });
    }).catch(() => {
      if (!cancelled) setDetailPreview({ toolId: id, previewJson: "" });
    });
    return () => { cancelled = true; };
  }, [selection, catalog, previewAdd, detailPreview]);

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
  } else if (selection.kind === "help") {
    main = <SkillGuide />;
  } else if (selection.kind === "library") {
    const libTools = catalog?.tools ?? [];
    if (selection.view === "landing") {
      main = (
        <LibraryLandingPage
          tools={libTools}
          installedIds={installedIds}
          onSelectTool={(t: CatalogTool) =>
            setSelection({ kind: "library", view: "detail", toolId: t.id })
          }
          onSeeAll={() => setSelection({ kind: "library", view: "all" })}
        />
      );
    } else if (selection.view === "all") {
      main = (
        <LibraryAllPage
          tools={libTools}
          installedIds={installedIds}
          onSelectTool={(t: CatalogTool) =>
            setSelection({ kind: "library", view: "detail", toolId: t.id })
          }
          onBack={() => setSelection({ kind: "library", view: "landing" })}
        />
      );
    } else {
      const tool = libTools.find(t => t.id === selection.toolId);
      if (!tool) {
        main = (
          <div className="px-8 py-6 text-ink-3">
            That tool isn't in the catalog anymore.
            <button
              type="button"
              className="ml-2 underline"
              onClick={() => setSelection({ kind: "library", view: "landing" })}
            >
              Back to Library
            </button>
          </div>
        );
      } else {
        main = (
          <LibraryToolDetailPage
            tool={tool}
            installed={installedIds.has(tool.id)}
            previewJson={detailPreview?.previewJson ?? ""}
            busy={addBusy || removeBusy}
            onAdd={async () => {
              const preview = await previewAdd(tool);
              await commitAdd(preview.after);
              await reload();
            }}
            onRemove={async () => {
              await commitRemove(tool.id);
              await reload();
            }}
            onBack={() => setSelection({ kind: "library", view: "landing" })}
          />
        );
      }
    }
  } else if (selection.kind === "settings") {
    main = <SettingsPage />;
  } else if (selectedTool) {
    main = (
      <ToolDetail
        tool={selectedTool}
        onBack={() => setSelection({ kind: "all" })}
      />
    );
  } else {
    main = (
      <HomeAllTools
        tools={tools}
        filteredTools={filteredTools}
        showStrips={selection.kind === "all" && query.trim() === ""}
        browserTitle={browserTitle}
        browserSub={browserSub}
        onPick={(id) => setSelection({ kind: "tool", id })}
        runningToolIds={runningIds}
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
          running={running}
        />
      }
      main={main}
    />
  );
}
