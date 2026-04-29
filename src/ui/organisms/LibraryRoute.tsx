import { useMemo } from "react";
import { useApp } from "../../state/AppContext";
import { useAddTool, useCatalog, useRemoveTool } from "../../application/useLibrary";
import type { CatalogTool } from "../../domain/library";
import type { LibrarySelection } from "./Sidebar";
import { LibraryLandingPage } from "../pages/LibraryLandingPage";
import { LibraryAllPage } from "../pages/LibraryAllPage";
import { LibraryToolDetailPage } from "../pages/LibraryToolDetailPage";

interface Props {
  selection: LibrarySelection;
  onNavigate: (next: LibrarySelection) => void;
  /** Reload tools.json after add/remove so installed-state reflects the change. */
  onConfigChanged: () => Promise<void> | void;
}

/** Routes between the three Library surfaces and orchestrates Add / Remove
 *  through the application ports. The page components stay pure presentation. */
export function LibraryRoute({ selection, onNavigate, onConfigChanged }: Props) {
  const { state } = useApp();
  const { catalog } = useCatalog();
  const { previewAdd, commit: commitAdd, busy: addBusy } = useAddTool();
  const { remove: commitRemove, busy: removeBusy } = useRemoveTool();

  const tools = catalog?.tools ?? [];
  const installedIds = useMemo(
    () => new Set(state.tools.map((t) => t.id)),
    [state.tools],
  );

  const openDetail = (t: CatalogTool) =>
    onNavigate({ kind: "library", view: "detail", toolId: t.id });
  const openLanding = () => onNavigate({ kind: "library", view: "landing" });
  const openAll = () => onNavigate({ kind: "library", view: "all" });

  if (selection.view === "landing") {
    return (
      <LibraryLandingPage
        tools={tools}
        installedIds={installedIds}
        onSelectTool={openDetail}
        onSeeAll={openAll}
      />
    );
  }

  if (selection.view === "all") {
    return (
      <LibraryAllPage
        tools={tools}
        installedIds={installedIds}
        onSelectTool={openDetail}
        onBack={openLanding}
      />
    );
  }

  const tool = tools.find((t) => t.id === selection.toolId);
  if (!tool) return <ToolNotFound onBack={openLanding} />;

  return (
    <LibraryToolDetailPage
      tool={tool}
      installed={installedIds.has(tool.id)}
      busy={addBusy || removeBusy}
      onAdd={async () => {
        const preview = await previewAdd(tool);
        await commitAdd(preview.after);
        await onConfigChanged();
      }}
      onRemove={async () => {
        await commitRemove(tool.id);
        await onConfigChanged();
      }}
      onBack={openLanding}
    />
  );
}

function ToolNotFound({ onBack }: { onBack: () => void }) {
  return (
    <div className="px-8 py-6 text-ink-3">
      That tool isn't in the catalog anymore.
      <button type="button" className="ml-2 underline" onClick={onBack}>
        Back to Library
      </button>
    </div>
  );
}
