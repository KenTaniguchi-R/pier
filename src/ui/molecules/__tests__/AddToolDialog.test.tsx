import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AddToolDialog } from "../AddToolDialog";
import type { CatalogTool } from "../../../domain/library";
import type { LibraryAddPreview } from "../../../application/ports";

const tool: CatalogTool = {
  id: "kp",
  name: "Kill port",
  version: "1.0.0",
  description: "Free a port held by a stuck process.",
  category: "dev",
  permissions: { network: true, fsRead: ["~/Documents"], fsWrite: [] },
  script: "echo",
};

const preview: LibraryAddPreview = {
  before: "{}",
  after: "{\n  \"id\": \"kp\"\n}\n",
  newTool: { id: "kp", name: "Kill port", command: "/path", args: [], parameters: [], env: {} } as any,
};

describe("AddToolDialog", () => {
  it("renders permissions consent labels", () => {
    render(
      <AddToolDialog
        tool={tool}
        preview={preview}
        busy={false}
        onClose={() => {}}
        onConfirm={() => {}}
      />
    );
    expect(screen.getByText(/internet/i)).toBeInTheDocument();
    expect(screen.getByText("~/Documents")).toBeInTheDocument();
  });

  it("renders 'No special permissions' when all empty", () => {
    const empty = { ...tool, permissions: { network: false, fsRead: [], fsWrite: [] } };
    render(
      <AddToolDialog
        tool={empty}
        preview={preview}
        busy={false}
        onClose={() => {}}
        onConfirm={() => {}}
      />
    );
    expect(screen.getByText(/no special permissions\./i)).toBeInTheDocument();
  });

  it("calls onConfirm with the after-text when Add clicked", () => {
    const onConfirm = vi.fn();
    render(
      <AddToolDialog
        tool={tool}
        preview={preview}
        busy={false}
        onClose={() => {}}
        onConfirm={onConfirm}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /add to my tools/i }));
    expect(onConfirm).toHaveBeenCalledWith(preview.after);
  });

  it("disables buttons when busy", () => {
    render(
      <AddToolDialog
        tool={tool}
        preview={preview}
        busy={true}
        onClose={() => {}}
        onConfirm={() => {}}
      />
    );
    expect(screen.getByRole("button", { name: /cancel/i })).toBeDisabled();
    const addBtn = screen.getByRole("button", { name: /adding/i });
    expect(addBtn).toBeDisabled();
  });
});
