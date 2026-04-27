import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SecretField } from "../SecretField";

describe("SecretField", () => {
  it("renders a password input by default", () => {
    render(<SecretField id="t" label="Token" value="" onChange={() => {}} />);
    const input = screen.getByLabelText("Token") as HTMLInputElement;
    expect(input.type).toBe("password");
  });

  it("toggles to text when reveal pressed, back to password on second press", () => {
    render(<SecretField id="t" label="Token" value="abc" onChange={() => {}} />);
    const input = screen.getByLabelText("Token") as HTMLInputElement;
    const toggle = screen.getByRole("button", { name: /show|reveal/i });
    fireEvent.click(toggle);
    expect(input.type).toBe("text");
    fireEvent.click(toggle);
    expect(input.type).toBe("password");
  });
});
