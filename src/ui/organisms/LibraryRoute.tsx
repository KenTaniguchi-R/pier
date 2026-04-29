import { useMemo } from "react";
import { useApp } from "../../state/AppContext";
import { useCatalog } from "../../application/useLibrary";
import type { CatalogTool } from "../../domain/library";
import type { LibrarySelection } from "./Sidebar";
import { LibraryLandingPage } from "../pages/LibraryLandingPage";
import { LibraryAllPage } from "../pages/LibraryAllPage";
import { LibraryLandingSkeleton } from "./LibraryLandingSkeleton";
import { LibraryAllSkeleton } from "./LibraryAllSkeleton";
import { LibraryToolDetailSkeleton } from "./LibraryToolDetailSkeleton";
import { LibraryToolDetail } from "./LibraryToolDetail";
import { LibraryErrorState } from "../molecules/LibraryErrorState";

interface Props {
  selection: LibrarySelection;
  onNavigate: (next: LibrarySelection) => void;
  /** Reload tools.json after add/remove so installed-state reflects the change. */
  onConfigChanged: () => Promise<void> | void;
}

/** Routes between the three Library surfaces. Per-tool action state lives in
 *  LibraryToolDetail so it resets naturally as the user navigates. */
export function LibraryRoute({ selection, onNavigate, onConfigChanged }: Props) {
  const { state } = useApp();
  const { status, catalog, error, retry } = useCatalog();

  const tools = catalog?.tools ?? [];
  const installedIds = useMemo(
    () => new Set(state.tools.map((t) => t.id)),
    [state.tools],
  );

  const openDetail = (t: CatalogTool) =>
    onNavigate({ kind: "library", view: "detail", toolId: t.id });
  const openLanding = () => onNavigate({ kind: "library", view: "landing" });
  const openAll = () => onNavigate({ kind: "library", view: "all" });

  if (status === "idle" || status === "loading") {
    if (selection.view === "all")    return <LibraryAllSkeleton onBack={openLanding} />;
    if (selection.view === "detail") return <LibraryToolDetailSkeleton onBack={openLanding} />;
    return <LibraryLandingSkeleton />;
  }

  if (status === "error") {
    return <LibraryErrorState error={error ?? "Failed to load library."} onRetry={retry} />;
  }

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
    <LibraryToolDetail
      key={tool.id}
      tool={tool}
      installed={installedIds.has(tool.id)}
      onConfigChanged={onConfigChanged}
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
