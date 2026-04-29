import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LibraryAllPage } from "../LibraryAllPage";
import type { CatalogTool } from "../../../domain/library";

function tool(id: string, category: string, name = `T-${id}`): CatalogTool {
  return {
    id, name, version: "1.0.0", description: `desc ${id}`, category,
    outcome: `outcome ${id}`,
    permissions: { network: "none", files: "none", system: "none", sentences: [] },
  };
}

describe("LibraryAllPage", () => {
  const tools = [tool("a", "system"), tool("b", "system"), tool("c", "general")];

  it("renders all tools by default", () => {
    render(<LibraryAllPage tools={tools} installedIds={new Set()} onSelectTool={() => {}} onBack={() => {}} />);
    expect(screen.getByText("T-a")).toBeInTheDocument();
    expect(screen.getByText("T-c")).toBeInTheDocument();
  });

  it("filters by search query against name and outcome", async () => {
    render(<LibraryAllPage tools={tools} installedIds={new Set()} onSelectTool={() => {}} onBack={() => {}} />);
    await userEvent.type(screen.getByPlaceholderText(/search/i), "outcome a");
    expect(screen.getByText("T-a")).toBeInTheDocument();
    expect(screen.queryByText("T-b")).not.toBeInTheDocument();
  });

  it("filters by category chip", async () => {
    render(<LibraryAllPage tools={tools} installedIds={new Set()} onSelectTool={() => {}} onBack={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: "general" }));
    expect(screen.queryByText("T-a")).not.toBeInTheDocument();
    expect(screen.getByText("T-c")).toBeInTheDocument();
  });

  it("calls onBack when Back is clicked", async () => {
    const onBack = vi.fn();
    render(<LibraryAllPage tools={tools} installedIds={new Set()} onSelectTool={() => {}} onBack={onBack} />);
    await userEvent.click(screen.getByRole("button", { name: /back/i }));
    expect(onBack).toHaveBeenCalled();
  });
});
