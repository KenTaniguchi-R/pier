import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { Toast } from "../Toast";

describe("Toast", () => {
  it("renders only when open", () => {
    const { rerender, queryByRole } = render(<Toast open={false}>hi</Toast>);
    expect(queryByRole("status")).toBeNull();
    rerender(<Toast open={true}>hi</Toast>);
    expect(queryByRole("status")).not.toBeNull();
  });
  it("ESC fires onDismiss", () => {
    const onDismiss = vi.fn();
    render(<Toast open onDismiss={onDismiss}>hi</Toast>);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onDismiss).toHaveBeenCalled();
  });
  it("clicking the action fires its handler", () => {
    const onClick = vi.fn();
    render(<Toast open action={{ label: "Go", onClick }}>hi</Toast>);
    fireEvent.click(screen.getByRole("button", { name: "Go" }));
    expect(onClick).toHaveBeenCalled();
  });
});
