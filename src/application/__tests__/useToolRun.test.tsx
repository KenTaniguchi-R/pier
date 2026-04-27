import { describe, it, expect, vi } from "vitest";
import { act, render, renderHook } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { useToolRun } from "../useToolRun";
import { AppProvider } from "../../state/AppContext";
import { RunnerProvider } from "../../state/RunnerContext";
import type { CommandRunner } from "../ports";
import type { Tool } from "../../domain/tool";

function mockRunner(): CommandRunner {
  return {
    run: vi.fn().mockResolvedValue({
      runId: "r1", status: "running", exitCode: null,
      startedAt: 1, endedAt: null, outputFiles: [],
    }),
    kill: vi.fn().mockResolvedValue(undefined),
    onOutput: vi.fn().mockReturnValue(() => {}),
    onExit: vi.fn().mockReturnValue(() => {}),
  };
}

function wrapper(runner: CommandRunner) {
  return ({ children }: { children: ReactNode }) => (
    <AppProvider>
      <RunnerProvider runner={runner}>{children}</RunnerProvider>
    </AppProvider>
  );
}

describe("useToolRun", () => {
  it("disables run when a required parameter is missing", () => {
    const tool: Tool = { id: "t", name: "T", command: "/x",
      parameters: [{ id: "url", label: "URL", type: "url" }] };
    const { result } = renderHook(() => useToolRun(tool), { wrapper: wrapper(mockRunner()) });
    expect(result.current.canRun).toBe(false);
    expect(result.current.blockedReason).toMatch(/url/i);
  });

  it("opens the confirm dialog when onRunClick fires (default confirm)", () => {
    const tool: Tool = { id: "t", name: "T", command: "/x" };
    const runner = mockRunner();
    const { result } = renderHook(() => useToolRun(tool), { wrapper: wrapper(runner) });
    act(() => result.current.onRunClick());
    expect(result.current.confirmOpen).toBe(true);
    expect(runner.run).not.toHaveBeenCalled();
  });

  it("skips confirm when tool.confirm === false", async () => {
    const tool: Tool = { id: "t", name: "T", command: "/x", confirm: false };
    const runner = mockRunner();
    const { result } = renderHook(() => useToolRun(tool), { wrapper: wrapper(runner) });
    await act(async () => { await result.current.onRunClick(); });
    expect(runner.run).toHaveBeenCalledWith("t", {}, false);
  });

  it("setValue updates blocker state", () => {
    const tool: Tool = { id: "t", name: "T", command: "/x",
      parameters: [{ id: "name", label: "Name", type: "text" }] };
    const { result } = renderHook(() => useToolRun(tool), { wrapper: wrapper(mockRunner()) });
    expect(result.current.canRun).toBe(false);
    act(() => result.current.setValue("name", "alice"));
    expect(result.current.canRun).toBe(true);
  });

  it("Cmd+Enter triggers a run when ready", async () => {
    const tool: Tool = { id: "t", name: "T", command: "/x", confirm: false };
    const runner = mockRunner();
    function Probe() {
      useToolRun(tool);
      return <div>ready</div>;
    }
    render(<Probe />, { wrapper: wrapper(runner) });
    await userEvent.keyboard("{Meta>}{Enter}{/Meta}");
    await vi.waitFor(() => expect(runner.run).toHaveBeenCalledOnce());
  });
});
