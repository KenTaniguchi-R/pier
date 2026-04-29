import { invoke } from "@tauri-apps/api/core";
import type { Catalog, CatalogTool } from "../domain/library";
import type { LibraryAddPreview, LibraryClient } from "../application/ports";
import type { Tool } from "../domain/tool";

interface RustPreview {
  before: string;
  after: string;
  new_tool: Tool;
}

export const tauriLibraryClient: LibraryClient = {
  fetchCatalog: () => invoke<Catalog>("library_fetch_catalog"),
  async installAndPreview(tool: CatalogTool): Promise<LibraryAddPreview> {
    const r = await invoke<RustPreview>("library_install_and_preview", { tool });
    return { before: r.before, after: r.after, newTool: r.new_tool };
  },
  commitAdd: (after: string) => invoke<void>("library_commit_add", { after }),
  commitRemove: (toolId: string) => invoke<void>("library_commit_remove", { toolId }),
};
