import { Fragment } from "react";
import { useDialogA11y } from "./useDialogA11y";
import { PermissionPill } from "../atoms/PermissionPill";
import { Button } from "../atoms/Button";
import type { CatalogTool } from "../../domain/library";
import type { LibraryAddPreview } from "../../application/ports";

interface Props {
  tool: CatalogTool;
  preview: LibraryAddPreview;
  busy: boolean;
  onClose: () => void;
  onConfirm: (after: string) => void;
}

type PermItem = { key: string; kind: "network" | "fsRead" | "fsWrite"; path?: string };

function permItems({ network, files }: CatalogTool["permissions"]): PermItem[] {
  const out: PermItem[] = [];
  if (network !== "none") out.push({ key: "network", kind: "network" });
  if (files === "read-only") out.push({ key: "fsRead", kind: "fsRead" });
  if (files === "writes") out.push({ key: "fsWrite", kind: "fsWrite" });
  return out;
}

export function AddToolDialog({ tool, preview, busy, onClose, onConfirm }: Props) {
  const panelRef = useDialogA11y({ open: true, onEscape: onClose });
  const perms = permItems(tool.permissions);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-tool-heading"
      className="fixed inset-0 z-50 grid place-items-center bg-ink/12 backdrop-blur-sm animate-overlay-in"
    >
      <div
        ref={panelRef}
        className="
          bg-surface border border-line rounded-3 shadow-pop
          w-[640px] max-w-[92vw] max-h-[80vh]
          flex flex-col animate-panel-in
        "
      >
        <header className="px-6 pt-5 pb-4 border-b border-line">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink-3 mb-1">
            Library · Add
          </div>
          <h2 id="add-tool-heading" className="font-display text-2xl leading-tight text-ink">
            Add {tool.name}
          </h2>
          <p className="mt-1.5 text-[13px] text-ink-3">{tool.description}</p>
        </header>

        <section className="px-6 py-4 border-b border-line">
          {perms.length === 0 ? (
            <p className="font-display italic text-[14px] text-ink-3">No special permissions.</p>
          ) : (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
              {perms.map((p, i) => (
                <Fragment key={p.key}>
                  {i > 0 && <span aria-hidden className="text-ink-4">·</span>}
                  <PermissionPill kind={p.kind} path={p.path} />
                </Fragment>
              ))}
            </div>
          )}
        </section>

        <div className="flex-1 overflow-auto bg-bg-2/50">
          <div className="px-6 py-3 font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink-3 border-b border-line">
            tools.json — preview
          </div>
          <pre className="px-6 py-4 font-mono text-[12px] leading-relaxed text-ink-2 whitespace-pre">
            {preview.after}
          </pre>
        </div>

        <footer className="px-6 py-4 border-t border-line flex items-center justify-between gap-3">
          <span className="font-mono text-[10.5px] uppercase tracking-wider text-ink-4">
            from pier-tools
          </span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => onConfirm(preview.after)}
              disabled={busy}
            >
              {busy ? "Adding…" : "Add to my tools"}
            </Button>
          </div>
        </footer>
      </div>
    </div>
  );
}
