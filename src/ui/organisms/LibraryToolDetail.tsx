import { useState } from "react";
import type { CatalogTool } from "../../domain/library";
import { useAddTool, useRemoveTool } from "../../application/useLibrary";
import { LibraryToolDetailPage } from "../pages/LibraryToolDetailPage";

interface Props {
  tool: CatalogTool;
  installed: boolean;
  onConfigChanged: () => Promise<void> | void;
  onBack: () => void;
}

/** Owns Add / Remove orchestration for a single catalog tool. Mounted per
 *  toolId by LibraryRoute, so action state (busy, error) is naturally scoped
 *  to the tool currently on screen. */
export function LibraryToolDetail({ tool, installed, onConfigChanged, onBack }: Props) {
  const { previewAdd, commit: commitAdd, busy: addBusy } = useAddTool();
  const { remove: commitRemove, busy: removeBusy } = useRemoveTool();
  const [error, setError] = useState<string | null>(null);

  const run = async (op: () => Promise<unknown>) => {
    setError(null);
    try {
      await op();
      await onConfigChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <LibraryToolDetailPage
      tool={tool}
      installed={installed}
      busy={addBusy || removeBusy}
      error={error}
      onAdd={() => run(async () => {
        const preview = await previewAdd(tool);
        await commitAdd(preview.after);
      })}
      onRemove={() => run(() => commitRemove(tool.id))}
      onBack={onBack}
    />
  );
}
