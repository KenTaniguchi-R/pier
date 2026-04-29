import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CatalogRow } from "../CatalogRow";
import type { CatalogTool } from "../../../domain/library";

const tool = (id: string): CatalogTool => ({
  id, name: `Tool ${id}`, version: "1.0.0", description: "", category: "x",
  outcome: `Does ${id}`,
  permissions: { network: "none", files: "none", system: "none", sentences: [] },
});

describe("CatalogRow", () => {
  it("renders title and cards", () => {
    render(
      <CatalogRow
        title="Featured"
        tools={[tool("a"), tool("b")]}
        installedIds={new Set()}
        onSelectTool={() => {}}
      />
    );
    expect(screen.getByText("Featured")).toBeInTheDocument();
    expect(screen.getByText("Tool a")).toBeInTheDocument();
    expect(screen.getByText("Tool b")).toBeInTheDocument();
  });

  it("renders See all when onSeeAll is provided", async () => {
    const onSeeAll = vi.fn();
    render(
      <CatalogRow
        title="New"
        tools={[tool("a")]}
        installedIds={new Set()}
        onSelectTool={() => {}}
        onSeeAll={onSeeAll}
      />
    );
    await userEvent.click(screen.getByRole("button", { name: /see all/i }));
    expect(onSeeAll).toHaveBeenCalled();
  });

  it("returns null when tools is empty", () => {
    const { container } = render(
      <CatalogRow title="Featured" tools={[]} installedIds={new Set()} onSelectTool={() => {}} />
    );
    expect(container.firstChild).toBeNull();
  });
});
