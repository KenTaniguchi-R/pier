import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PermissionPill } from "../PermissionPill";

describe("PermissionPill", () => {
  it("renders the network label", () => {
    render(<PermissionPill kind="network" />);
    expect(screen.getByText(/internet/i)).toBeInTheDocument();
  });

  it("renders fsRead with a path", () => {
    render(<PermissionPill kind="fsRead" path="~/Documents" />);
    expect(screen.getByText(/reads/i)).toBeInTheDocument();
    expect(screen.getByText("~/Documents")).toBeInTheDocument();
  });

  it("renders fsWrite with a path", () => {
    render(<PermissionPill kind="fsWrite" path="~/Downloads" />);
    expect(screen.getByText(/writes/i)).toBeInTheDocument();
    expect(screen.getByText("~/Downloads")).toBeInTheDocument();
  });
});
