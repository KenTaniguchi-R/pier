import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LibraryToolDetailPage } from "../LibraryToolDetailPage";
import type { CatalogTool } from "../../../domain/library";

const tool: CatalogTool = {
  id: "kill-port",
  name: "Kill process on port",
  version: "1.0.0",
  description: "Free up a port held by a stuck process.",
  category: "system",
  outcome: "Free up a stuck port",
  audience: ["developer"],
  examples: ["pier kill-port 3000"],
  permissions: {
    network: "none",
    files: "none",
    system: "kills-processes",
    sentences: ["runs-locally", "may-terminate-processes"],
  },
};

describe("LibraryToolDetailPage", () => {
  it("renders hero, permissions, and examples", () => {
    render(
      <LibraryToolDetailPage
        tool={tool}
        installed={false}
        busy={false}
        onAdd={() => {}}
        onRemove={() => {}}
        error={null}
        onBack={() => {}}
      />
    );
    expect(screen.getByRole("heading", { level: 1, name: tool.name })).toBeInTheDocument();
    expect(screen.getByText("Free up a stuck port")).toBeInTheDocument();
    expect(screen.getByText("Runs locally on your machine.")).toBeInTheDocument();
    expect(screen.getByText("pier kill-port 3000")).toBeInTheDocument();
  });

  it("shows Add button when not installed and calls onAdd", async () => {
    const onAdd = vi.fn();
    render(
      <LibraryToolDetailPage
        tool={tool}
        installed={false}
        busy={false}
        onAdd={onAdd}
        onRemove={() => {}}
        error={null}
        onBack={() => {}}
      />
    );
    await userEvent.click(screen.getByRole("button", { name: /add to my tools/i }));
    expect(onAdd).toHaveBeenCalled();
  });

  it("shows Added (disabled) and a Remove link when installed", async () => {
    const onRemove = vi.fn();
    render(
      <LibraryToolDetailPage
        tool={tool}
        installed={true}
        busy={false}
        onAdd={() => {}}
        onRemove={onRemove}
        error={null}
        onBack={() => {}}
      />
    );
    expect(screen.getByRole("button", { name: /added/i })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: /remove/i }));
    expect(onRemove).toHaveBeenCalled();
  });

  it("does not render an Advanced disclosure", () => {
    render(
      <LibraryToolDetailPage
        tool={tool}
        installed={false}
        busy={false}
        onAdd={() => {}}
        onRemove={() => {}}
        error={null}
        onBack={() => {}}
      />
    );
    expect(screen.queryByText(/advanced/i)).not.toBeInTheDocument();
  });

  it("surfaces an install error with retry that calls onAdd", async () => {
    const onAdd = vi.fn();
    render(
      <LibraryToolDetailPage
        tool={tool}
        installed={false}
        busy={false}
        error="sha256 mismatch: expected abc, got def"
        onAdd={onAdd}
        onRemove={() => {}}
        onBack={() => {}}
      />
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText(/that didn't land/i)).toBeInTheDocument();
    expect(screen.getByText(/sha256 mismatch/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(onAdd).toHaveBeenCalled();
  });

  it("calls onBack when Back is clicked", async () => {
    const onBack = vi.fn();
    render(
      <LibraryToolDetailPage
        tool={tool}
        installed={false}
        busy={false}
        onAdd={() => {}}
        onRemove={() => {}}
        error={null}
        onBack={onBack}
      />
    );
    await userEvent.click(screen.getByRole("button", { name: /back/i }));
    expect(onBack).toHaveBeenCalled();
  });
});
