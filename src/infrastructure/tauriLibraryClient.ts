import { invoke } from "@tauri-apps/api/core";
import type { Catalog, CatalogTool } from "../domain/library";
import type { LibraryAddPreview, LibraryClient } from "../application/ports";

export const tauriLibraryClient: LibraryClient = {
  fetchCatalog: () => invoke<Catalog>("library_fetch_catalog"),
  installAndPreview: (tool: CatalogTool) =>
    invoke<LibraryAddPreview>("library_install_and_preview", { tool }),
  commitAdd: (after: string) => invoke<void>("library_commit_add", { after }),
  commitRemove: (toolId: string) => invoke<void>("library_commit_remove", { toolId }),
};
