import { useMemo, useState } from "react";
import { useCatalog, useAddTool } from "../../application/useLibrary";
import { LibraryToolCard } from "../molecules/LibraryToolCard";
import { AddToolDialog } from "../molecules/AddToolDialog";
import { TextField } from "../atoms/TextField";
import type { CatalogTool } from "../../domain/library";
import type { LibraryAddPreview } from "../../application/ports";

export function LibraryBrowser() {
  const { status, catalog, error } = useCatalog();
  const { previewAdd, commit, busy } = useAddTool();
  const [query, setQuery] = useState("");
  const [pending, setPending] = useState<{ tool: CatalogTool; preview: LibraryAddPreview } | null>(null);

  const visible = useMemo(() => {
    if (!catalog) return [];
    const q = query.trim().toLowerCase();
    if (q === "") return catalog.tools;
    return catalog.tools.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q),
    );
  }, [catalog, query]);

  const onSelect = async (tool: CatalogTool) => {
    try {
      const preview = await previewAdd(tool);
      setPending({ tool, preview });
    } catch (e) {
      console.error("install/preview failed", e);
    }
  };

  return (
    <div className="flex flex-col gap-5 px-8 py-6">
      <header>
        <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink-3 mb-1.5">
          Library
        </div>
        <h1 className="font-display text-3xl leading-tight text-ink">Add a tool</h1>
        <p className="mt-1.5 text-[14px] text-ink-3">
          Curated, signed tools from the <span className="font-mono">pier-tools</span> catalog.
        </p>
      </header>

      <TextField
        variant="compact"
        placeholder="Search the library…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {status === "loading" && (
        <p className="text-[13px] text-ink-3">Loading…</p>
      )}
      {status === "error" && (
        <p className="text-[13px] text-danger" role="alert">
          Couldn't reach the catalog: {error}
        </p>
      )}

      {status === "ready" && visible.length === 0 && (
        <p className="font-display italic text-ink-3">No tools match.</p>
      )}

      {status === "ready" && visible.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {visible.map((t, i) => (
            <LibraryToolCard
              key={t.id}
              tool={t}
              onSelect={onSelect}
              style={{ animationDelay: `${i * 30}ms` }}
            />
          ))}
        </div>
      )}

      {pending && (
        <AddToolDialog
          tool={pending.tool}
          preview={pending.preview}
          busy={busy}
          onClose={() => setPending(null)}
          onConfirm={async (after) => {
            await commit(after);
            setPending(null);
          }}
        />
      )}
    </div>
  );
}
