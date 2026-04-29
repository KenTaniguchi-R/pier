import { describe, it, expect } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { LibraryProvider } from "../../state/LibraryContext";
import { useCatalog } from "../useLibrary";
import type { LibraryClient } from "../ports";

const fake: LibraryClient = {
  fetchCatalog: async () => ({
    catalogSchemaVersion: 1,
    publishedAt: "2026-05-15T00:00:00Z",
    tools: [{
      id: "k", name: "K", version: "1.0.0", description: "d",
      category: "dev",
      permissions: { network: false, fsRead: [], fsWrite: [] },
      script: "echo",
    }],
  }),
  installAndPreview: async () => ({ before: "", after: "", newTool: {} as any }),
  commitAdd: async () => {},
};

describe("useCatalog", () => {
  it("loads the catalog into state", async () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <LibraryProvider client={fake}>{children}</LibraryProvider>
    );
    const { result } = renderHook(() => useCatalog(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.catalog?.tools[0].id).toBe("k");
  });
});
