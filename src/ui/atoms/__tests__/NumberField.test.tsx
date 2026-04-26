import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NumberField } from "../NumberField";

describe("NumberField", () => {
  it("renders as a number input", () => {
    render(<NumberField aria-label="port" defaultValue={8080} />);
    const input = screen.getByLabelText("port") as HTMLInputElement;
    expect(input.type).toBe("number");
  });

  it("forwards onChange", () => {
    let v = 0;
    render(<NumberField aria-label="n" value={v} onChange={e => (v = Number(e.target.value))} />);
    fireEvent.change(screen.getByLabelText("n"), { target: { value: "42" } });
    expect(v).toBe(42);
  });
});
