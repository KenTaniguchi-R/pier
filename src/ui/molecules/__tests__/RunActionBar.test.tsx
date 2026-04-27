import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RunActionBar } from "../RunActionBar";

describe("RunActionBar", () => {
  it("shows the keyboard hint when ready", () => {
    render(
      <RunActionBar
        running={false}
        startedAt={null}
        canRun
        onRun={() => {}}
        onStop={() => {}}
      />
    );
    expect(screen.getByText("⌘↵ to run")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /run/i })).not.toBeDisabled();
  });

  it("shows the blocker reason when not runnable", () => {
    render(
      <RunActionBar
        running={false}
        startedAt={null}
        canRun={false}
        blockedReason="Add video file to run"
        onRun={() => {}}
        onStop={() => {}}
      />
    );
    expect(screen.getByText("Add video file to run")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /run/i })).toBeDisabled();
  });

  it("shows running status with elapsed and a Stop button", () => {
    render(
      <RunActionBar
        running
        startedAt={Date.now() - 5000}
        canRun
        onRun={() => {}}
        onStop={() => {}}
      />
    );
    expect(screen.getByText(/Running · 0:0\d/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /stop/i })).toBeInTheDocument();
  });

  it("delegates Run click to onRun", async () => {
    const onRun = vi.fn();
    render(
      <RunActionBar
        running={false}
        startedAt={null}
        canRun
        onRun={onRun}
        onStop={() => {}}
      />
    );
    await userEvent.click(screen.getByRole("button", { name: /run/i }));
    expect(onRun).toHaveBeenCalledOnce();
  });

  it("delegates Stop click to onStop", async () => {
    const onStop = vi.fn();
    render(
      <RunActionBar
        running
        startedAt={Date.now()}
        canRun
        onRun={() => {}}
        onStop={onStop}
      />
    );
    await userEvent.click(screen.getByRole("button", { name: /stop/i }));
    expect(onStop).toHaveBeenCalledOnce();
  });
});
