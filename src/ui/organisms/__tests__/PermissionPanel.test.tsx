import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PermissionPanel } from "../PermissionPanel";

describe("PermissionPanel", () => {
  it("renders three axis chips", () => {
    render(
      <PermissionPanel
        permissions={{
          network: "none",
          files: "read-only",
          system: "runs-commands",
          sentences: [],
        }}
      />
    );
    expect(screen.getByText(/no network/i)).toBeInTheDocument();
    expect(screen.getByText(/reads files/i)).toBeInTheDocument();
    expect(screen.getByText(/runs commands/i)).toBeInTheDocument();
  });

  it("renders provided sentences", () => {
    render(
      <PermissionPanel
        permissions={{
          network: "none",
          files: "none",
          system: "kills-processes",
          sentences: ["runs-locally", "may-terminate-processes"],
        }}
      />
    );
    expect(screen.getByText("Runs locally on your machine.")).toBeInTheDocument();
    expect(screen.getByText("May terminate processes you own.")).toBeInTheDocument();
  });

  it("hides the sentence list when empty", () => {
    const { container } = render(
      <PermissionPanel
        permissions={{ network: "none", files: "none", system: "none", sentences: [] }}
      />
    );
    expect(container.querySelector("ul")).toBeNull();
  });
});
