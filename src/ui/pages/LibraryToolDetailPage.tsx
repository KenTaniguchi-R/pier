import type { CatalogTool } from "../../domain/library";
import { outcomeOf } from "../../domain/library";
import { Button } from "../atoms/Button";
import { PermissionPanel } from "../organisms/PermissionPanel";

interface Props {
  tool: CatalogTool;
  installed: boolean;
  busy: boolean;
  error: string | null;
  onAdd: () => void;
  onRemove: () => void;
  onBack: () => void;
}

export function LibraryToolDetailPage({
  tool,
  installed,
  busy,
  error,
  onAdd,
  onRemove,
  onBack,
}: Props) {
  const outcome = outcomeOf(tool);
  const hasExtraDescription = !!tool.description && tool.description !== outcome;
  const examples = tool.examples ?? [];
  const showWhatItDoes = hasExtraDescription || examples.length > 0;
  return (
    <div className="flex flex-col gap-6 px-8 py-6">
      <button
        type="button"
        onClick={onBack}
        aria-label="Back to Library"
        className="self-start text-[13px] text-ink-3 hover:text-ink"
      >
        ← Back to Library
      </button>

      <header className="flex items-start justify-between gap-6">
        <div className="flex flex-col gap-1.5">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink-3">
            Library · Tool
          </div>
          <h1 className="font-display text-3xl leading-tight text-ink">{tool.name}</h1>
          <p className="text-[15px] text-ink-2">{outcome}</p>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          {installed ? (
            <>
              <Button variant="primary" disabled aria-label="Added">
                Added ✓
              </Button>
              <button
                type="button"
                onClick={onRemove}
                disabled={busy}
                className="text-[12px] text-ink-3 hover:text-danger underline-offset-2 hover:underline"
              >
                Remove
              </button>
            </>
          ) : (
            <Button variant="primary" onClick={onAdd} disabled={busy}>
              {busy ? "Adding…" : "Add to my tools"}
            </Button>
          )}
        </div>
      </header>

      {error && (
        <aside
          role="alert"
          className="relative flex flex-col gap-2 border-l-2 border-danger bg-danger-soft/60 pl-4 pr-3 py-3 rounded-r-2"
        >
          <div className="flex items-baseline justify-between gap-3">
            <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-danger">
              Install · Failed
            </div>
            <button
              type="button"
              onClick={onAdd}
              disabled={busy}
              className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink-3 hover:text-ink underline-offset-2 hover:underline disabled:opacity-40"
            >
              {busy ? "Retrying…" : "Try again ↻"}
            </button>
          </div>
          <p className="font-display text-[15px] leading-snug text-ink">
            That didn't land.
          </p>
          <pre className="font-mono text-[12px] leading-relaxed text-ink-2 whitespace-pre-wrap break-words">
            {error}
          </pre>
        </aside>
      )}

      <PermissionPanel permissions={tool.permissions} />

      {showWhatItDoes && (
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-xl text-ink">What it does</h2>
          {hasExtraDescription && (
            <p className="text-[14px] text-ink-2 leading-relaxed">{tool.description}</p>
          )}
          {examples.length > 0 && (
            <div className="flex flex-col gap-1.5">
              {examples.map((ex) => (
                <pre
                  key={ex}
                  className="font-mono text-[12px] bg-bg-2 border border-line rounded-2 px-3 py-2 text-ink-2"
                >
                  {ex}
                </pre>
              ))}
            </div>
          )}
        </section>
      )}

      <footer className="flex items-center gap-2 text-[11px] text-ink-4 font-mono uppercase tracking-wider">
        <span>From pier-tools</span>
        <span aria-hidden>·</span>
        <span>Verified</span>
      </footer>
    </div>
  );
}
