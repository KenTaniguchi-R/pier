import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CatalogCard } from "../CatalogCard";
import type { CatalogTool } from "../../../domain/library";

const baseTool: CatalogTool = {
  id: "kill-port",
  name: "Kill process on port",
  version: "1.0.0",
  description: "Free up a port held by a stuck process.",
  category: "system",
  outcome: "Free up a stuck port",
  audience: ["developer"],
  permissions: { network: "none", files: "none", system: "kills-processes", sentences: [] },
};

describe("CatalogCard", () => {
  it("renders name and outcome", () => {
    render(<CatalogCard tool={baseTool} installed={false} onSelect={() => {}} />);
    expect(screen.getByText("Kill process on port")).toBeInTheDocument();
    expect(screen.getByText("Free up a stuck port")).toBeInTheDocument();
  });

  it("falls back to description if outcome is missing", () => {
    const t = { ...baseTool, outcome: undefined };
    render(<CatalogCard tool={t} installed={false} onSelect={() => {}} />);
    expect(screen.getByText("Free up a port held by a stuck process.")).toBeInTheDocument();
  });

  it("hides audience tag when audience is empty", () => {
    const t = { ...baseTool, audience: [] };
    render(<CatalogCard tool={t} installed={false} onSelect={() => {}} />);
    expect(screen.queryByText(/developer/i)).not.toBeInTheDocument();
  });

  it("shows installed badge and adds aria-label when installed", () => {
    render(<CatalogCard tool={baseTool} installed={true} onSelect={() => {}} />);
    expect(screen.getByLabelText(/already added/i)).toBeInTheDocument();
  });

  it("calls onSelect with the tool when clicked", async () => {
    const onSelect = vi.fn();
    render(<CatalogCard tool={baseTool} installed={false} onSelect={onSelect} />);
    await userEvent.click(screen.getByRole("button"));
    expect(onSelect).toHaveBeenCalledWith(baseTool);
  });
});
