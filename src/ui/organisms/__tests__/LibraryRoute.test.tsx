import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LibraryRoute } from "../LibraryRoute";
import { AppProvider } from "../../../state/AppContext";
import { LibraryProvider } from "../../../state/LibraryContext";
import type { LibraryClient } from "../../../application/ports";
import type { Catalog } from "../../../domain/library";
import type { LibrarySelection } from "../Sidebar";

const validCatalog: Catalog = {
  catalogSchemaVersion: 1,
  publishedAt: "2026-04-29T00:00:00Z",
  tools: [
    {
      id: "x",
      name: "Tool X",
      version: "1.0.0",
      description: "Does stuff",
      category: "dev",
      outcome: "Does stuff fast",
      featured: true,
      permissions: { network: "none", files: "none", system: "none", sentences: [] },
    },
  ],
};

function makeClient(fetchCatalog: LibraryClient["fetchCatalog"]): LibraryClient {
  return {
    fetchCatalog,
    installAndPreview: vi.fn(),
    commitAdd: vi.fn(),
    commitRemove: vi.fn(),
  };
}

function renderRoute(
  client: LibraryClient,
  selection: LibrarySelection = { kind: "library", view: "landing" },
) {
  render(
    <AppProvider>
      <LibraryProvider client={client}>
        <LibraryRoute
          selection={selection}
          onNavigate={() => {}}
          onConfigChanged={() => {}}
        />
      </LibraryProvider>
    </AppProvider>,
  );
}

describe("LibraryRoute loading/error states", () => {
  it("renders landing skeleton (aria-busy) while catalog is pending", () => {
    const client = makeClient(() => new Promise(() => {}));
    renderRoute(client, { kind: "library", view: "landing" });
    expect(document.querySelector("[aria-busy='true']")).not.toBeNull();
    // The skeleton shows structural placeholders but no real tool names from the catalog
    expect(screen.queryByText("Tool X")).toBeNull();
  });

  it("renders all-tools skeleton on view:all while pending, back button present", () => {
    const client = makeClient(() => new Promise(() => {}));
    renderRoute(client, { kind: "library", view: "all" });
    expect(document.querySelector("[aria-busy='true']")).not.toBeNull();
    expect(screen.getByRole("button", { name: /back/i })).toBeInTheDocument();
  });

  it("renders detail skeleton on view:detail while pending, back-to-library button present", () => {
    const client = makeClient(() => new Promise(() => {}));
    renderRoute(client, { kind: "library", view: "detail", toolId: "x" });
    expect(document.querySelector("[aria-busy='true']")).not.toBeNull();
    expect(screen.getByRole("button", { name: /back to library/i })).toBeInTheDocument();
  });

  it("renders error state with message in role=alert, retry triggers second fetch", async () => {
    const fetchCatalog = vi
      .fn()
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce(validCatalog);
    const client = makeClient(fetchCatalog);
    renderRoute(client, { kind: "library", view: "landing" });

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(screen.getByRole("alert")).toHaveTextContent("boom");

    await userEvent.click(screen.getByRole("button", { name: /try again/i }));

    await waitFor(() => expect(screen.getByText("Featured")).toBeInTheDocument());
    expect(fetchCatalog).toHaveBeenCalledTimes(2);
  });

  it("renders real LibraryLandingPage with Featured row once catalog resolves", async () => {
    const client = makeClient(() => Promise.resolve(validCatalog));
    renderRoute(client, { kind: "library", view: "landing" });
    await waitFor(() => expect(screen.getByText("Featured")).toBeInTheDocument());
    expect(document.querySelector("[aria-busy='true']")).toBeNull();
  });
});
