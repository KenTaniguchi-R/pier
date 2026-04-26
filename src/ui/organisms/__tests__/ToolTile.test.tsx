import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToolTile } from "../ToolTile";
import { AppProvider } from "../../../state/AppContext";
import { RunnerProvider } from "../../../state/RunnerContext";
import type { Tool } from "../../../domain/tool";
import type { CommandRunner } from "../../../application/ports";

function mockRunner(): CommandRunner {
  return {
    run: vi.fn().mockResolvedValue({ runId: "r1", status: "running", exitCode: null, startedAt: 1, endedAt: null, outputFiles: [] }),
    kill: vi.fn().mockResolvedValue(undefined),
    onOutput: vi.fn().mockReturnValue(() => {}),
    onExit: vi.fn().mockReturnValue(() => {}),
  };
}

function wrap(tool: Tool, runner: CommandRunner) {
  return render(
    <AppProvider>
      <RunnerProvider runner={runner}>
        <ToolTile tool={tool} />
      </RunnerProvider>
    </AppProvider>
  );
}

describe("ToolTile", () => {
  it("renders DropZone for file input type", () => {
    const tool: Tool = { id: "t", name: "T", command: "/x", inputType: "file" };
    wrap(tool, mockRunner());
    expect(screen.getByText(/drop a file/i)).toBeInTheDocument();
  });

  it("disables Run when no input is provided", () => {
    const tool: Tool = { id: "t", name: "T", command: "/x", inputType: "url" };
    wrap(tool, mockRunner());
    expect(screen.getByRole("button", { name: /run/i })).toBeDisabled();
  });

  it("opens confirm dialog when Run clicked (default confirm)", async () => {
    const tool: Tool = { id: "t", name: "T", command: "/x", inputType: "none" };
    wrap(tool, mockRunner());
    await userEvent.click(screen.getByRole("button", { name: /run/i }));
    expect(screen.getByText(/run this tool/i)).toBeInTheDocument();
  });

  it("skips confirm and runs when tool.confirm === false", async () => {
    const tool: Tool = { id: "t", name: "T", command: "/x", inputType: "none", confirm: false };
    const runner = mockRunner();
    wrap(tool, runner);
    await userEvent.click(screen.getByRole("button", { name: /run/i }));
    expect(runner.run).toHaveBeenCalledOnce();
  });
});
