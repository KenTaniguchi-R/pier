import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LibraryToolCard } from "../LibraryToolCard";
import type { CatalogTool } from "../../../domain/library";

const tool: CatalogTool = {
  id: "kill-port",
  name: "Kill port",
  version: "1.0.0",
  description: "Free a port held by a stuck process.",
  category: "dev",
  tier: "beginner",
  permissions: { network: false, fsRead: [], fsWrite: [] },
  script: "echo",
};

describe("LibraryToolCard", () => {
  it("calls onSelect when clicked", () => {
    const onSelect = vi.fn();
    render(<LibraryToolCard tool={tool} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: /kill port/i }));
    expect(onSelect).toHaveBeenCalledWith(tool);
  });

  it("renders the version in mono and the description", () => {
    render(<LibraryToolCard tool={tool} onSelect={() => {}} />);
    expect(screen.getByText("v1.0.0")).toBeInTheDocument();
    expect(screen.getByText(/free a port/i)).toBeInTheDocument();
  });

  it("shows ADV chip for advanced tier", () => {
    render(<LibraryToolCard tool={{ ...tool, tier: "advanced" }} onSelect={() => {}} />);
    expect(screen.getByText("ADV")).toBeInTheDocument();
  });

  it("does NOT show ADV chip for beginner tier", () => {
    render(<LibraryToolCard tool={tool} onSelect={() => {}} />);
    expect(screen.queryByText("ADV")).toBeNull();
  });
});
