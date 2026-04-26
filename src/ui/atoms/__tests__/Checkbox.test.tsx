import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Checkbox } from "../Checkbox";

describe("Checkbox", () => {
  it("renders label", () => {
    render(<Checkbox label="DRY RUN" checked={false} onChange={() => {}} />);
    expect(screen.getByText("DRY RUN")).toBeTruthy();
  });

  it("fires onChange on click", () => {
    let v = false;
    const { container } = render(
      <Checkbox checked={v} onChange={e => (v = e.target.checked)} aria-label="x" />,
    );
    fireEvent.click(container.querySelector("input")!);
    expect(v).toBe(true);
  });
});
