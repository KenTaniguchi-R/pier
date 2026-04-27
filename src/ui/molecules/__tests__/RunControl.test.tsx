import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RunControl } from "../RunControl";

describe("RunControl", () => {
  it("renders Run when idle and fires onRun on click", async () => {
    const onRun = vi.fn();
    render(<RunControl running={false} canRun={true} onRun={onRun} onStop={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: /^run$/i }));
    expect(onRun).toHaveBeenCalledOnce();
  });

  it("disables Run when canRun is false", () => {
    render(<RunControl running={false} canRun={false} onRun={() => {}} onStop={() => {}} />);
    expect(screen.getByRole("button", { name: /^run$/i })).toBeDisabled();
  });

  it("renders Stop while running and fires onStop on click", async () => {
    const onStop = vi.fn();
    render(<RunControl running={true} canRun={false} onRun={() => {}} onStop={onStop} />);
    await userEvent.click(screen.getByRole("button", { name: /^stop$/i }));
    expect(onStop).toHaveBeenCalledOnce();
    expect(screen.queryByRole("button", { name: /^run$/i })).not.toBeInTheDocument();
  });
});
