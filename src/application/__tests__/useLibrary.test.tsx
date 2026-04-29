import { describe, it, expect, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { LibraryProvider } from "../../state/LibraryContext";
import { useCatalog, useRemoveTool } from "../useLibrary";
import type { LibraryClient } from "../ports";

const fake: LibraryClient = {
  fetchCatalog: async () => ({
    catalogSchemaVersion: 1,
    publishedAt: "2026-05-15T00:00:00Z",
    tools: [{
      id: "k", name: "K", version: "1.0.0", description: "d",
      category: "dev",
      permissions: { network: "none", files: "none", system: "none", sentences: [] },
      script: "echo",
    }],
  }),
  installAndPreview: async () => ({ before: "", after: "", newTool: {} as any }),
  commitAdd: async () => {},
  commitRemove: async () => {},
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

function wrapWith(client: LibraryClient) {
  return ({ children }: { children: ReactNode }) => (
    <LibraryProvider client={client}>{children}</LibraryProvider>
  );
}

describe("useRemoveTool", () => {
  it("calls client.commitRemove with the tool id", async () => {
    const client: LibraryClient = {
      fetchCatalog: vi.fn(),
      installAndPreview: vi.fn(),
      commitAdd: vi.fn(),
      commitRemove: vi.fn().mockResolvedValue(undefined),
    } as unknown as LibraryClient;
    const { result } = renderHook(() => useRemoveTool(), { wrapper: wrapWith(client) });
    await act(async () => { await result.current.remove("kill-port"); });
    expect(client.commitRemove).toHaveBeenCalledWith("kill-port");
  });
});
