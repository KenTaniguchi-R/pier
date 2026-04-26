import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Select } from "../Select";

describe("Select", () => {
  it("renders options", () => {
    render(<Select options={["mp4", "webm"]} defaultValue="mp4" aria-label="format" />);
    expect(screen.getByRole("combobox")).toBeTruthy();
    expect(screen.getByRole("option", { name: "mp4" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "webm" })).toBeTruthy();
  });

  it("fires onChange", () => {
    let v = "mp4";
    render(<Select options={["mp4", "webm"]} value={v} onChange={e => (v = e.target.value)} aria-label="format" />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "webm" } });
    expect(v).toBe("webm");
  });
});
