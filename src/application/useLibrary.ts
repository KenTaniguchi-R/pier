import { useCallback, useState } from "react";
import { useCatalogState, useLibraryClient } from "../state/LibraryContext";

/** Catalog state is owned by the provider so re-entering Library is a no-op
 *  fetch; this hook is just a thin re-export. */
export const useCatalog = useCatalogState;

export function useAddTool() {
  const client = useLibraryClient();
  const [busy, setBusy] = useState(false);

  const commit = useCallback(
    async (after: string) => {
      setBusy(true);
      try {
        await client.commitAdd(after);
      } finally {
        setBusy(false);
      }
    },
    [client],
  );

  return { busy, previewAdd: client.installAndPreview, commit };
}

export function useRemoveTool() {
  const client = useLibraryClient();
  const [busy, setBusy] = useState(false);

  const remove = useCallback(
    async (toolId: string) => {
      setBusy(true);
      try {
        await client.commitRemove(toolId);
      } finally {
        setBusy(false);
      }
    },
    [client],
  );

  return { busy, remove };
}
