import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LibraryErrorState } from "../LibraryErrorState";

describe("LibraryErrorState", () => {
  it("renders the error message inside an alert region", () => {
    render(<LibraryErrorState error="Network down" onRetry={() => {}} />);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Network down");
  });

  it("calls onRetry when Try again is clicked", async () => {
    const onRetry = vi.fn();
    render(<LibraryErrorState error="oops" onRetry={onRetry} />);
    await userEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
