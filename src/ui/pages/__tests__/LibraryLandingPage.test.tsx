import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LibraryLandingPage } from "../LibraryLandingPage";
import type { CatalogTool } from "../../../domain/library";

function tool(id: string, overrides: Partial<CatalogTool> = {}): CatalogTool {
  return {
    id,
    name: `T-${id}`,
    version: "1.0.0",
    description: "",
    category: "x",
    outcome: `Does ${id}`,
    permissions: { network: "none", files: "none", system: "none", sentences: [] },
    ...overrides,
  };
}

describe("LibraryLandingPage", () => {
  const today = new Date("2026-04-29T00:00:00Z");

  it("renders Featured row when there are featured tools", () => {
    const tools = [tool("a", { featured: true }), tool("b")];
    render(
      <LibraryLandingPage
        tools={tools}
        installedIds={new Set()}
        now={today}
        onSelectTool={() => {}}
        onSeeAll={() => {}}
      />
    );
    expect(screen.getByText("Featured")).toBeInTheDocument();
    expect(screen.getByText("T-a")).toBeInTheDocument();
  });

  it("renders New this week for tools with addedAt within 7 days", () => {
    const tools = [
      tool("recent", { addedAt: "2026-04-25" }),
      tool("old", { addedAt: "2026-01-01" }),
    ];
    render(
      <LibraryLandingPage
        tools={tools}
        installedIds={new Set()}
        now={today}
        onSelectTool={() => {}}
        onSeeAll={() => {}}
      />
    );
    expect(screen.getByText("New this week")).toBeInTheDocument();
    expect(screen.getByText("T-recent")).toBeInTheDocument();
    // The "old" tool only appears in Popular
  });

  it("renders For developers when audience includes developer", () => {
    const tools = [tool("dev", { audience: ["developer"] })];
    render(
      <LibraryLandingPage
        tools={tools}
        installedIds={new Set()}
        now={today}
        onSelectTool={() => {}}
        onSeeAll={() => {}}
      />
    );
    expect(screen.getByText("For developers")).toBeInTheDocument();
  });

  it("hides empty rows", () => {
    render(
      <LibraryLandingPage
        tools={[]}
        installedIds={new Set()}
        now={today}
        onSelectTool={() => {}}
        onSeeAll={() => {}}
      />
    );
    expect(screen.queryByText("Featured")).not.toBeInTheDocument();
    expect(screen.queryByText("Popular")).not.toBeInTheDocument();
  });

  it("invokes onSeeAll when See all is clicked", async () => {
    const onSeeAll = vi.fn();
    render(
      <LibraryLandingPage
        tools={[tool("a"), tool("b"), tool("c")]}
        installedIds={new Set()}
        now={today}
        onSelectTool={() => {}}
        onSeeAll={onSeeAll}
      />
    );
    await userEvent.click(screen.getAllByRole("button", { name: /see all/i })[0]);
    expect(onSeeAll).toHaveBeenCalled();
  });
});
