import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToolRunner } from "../ToolRunner";
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
        <ToolRunner tool={tool} />
      </RunnerProvider>
    </AppProvider>
  );
}

describe("ToolRunner", () => {
  it("renders DropZone for a file parameter", () => {
    const tool: Tool = {
      id: "t", name: "T", command: "/x",
      parameters: [{ id: "input", label: "Input file", type: "file" }],
    };
    wrap(tool, mockRunner());
    expect(screen.getByText(/drop a file/i)).toBeInTheDocument();
  });

  it("disables Run when a required parameter has no value", () => {
    const tool: Tool = {
      id: "t", name: "T", command: "/x",
      parameters: [{ id: "url", label: "URL", type: "url" }],
    };
    wrap(tool, mockRunner());
    expect(screen.getByRole("button", { name: /run/i })).toBeDisabled();
  });

  it("opens confirm dialog when Run clicked (no parameters, default confirm)", async () => {
    const tool: Tool = { id: "t", name: "T", command: "/x" };
    wrap(tool, mockRunner());
    await userEvent.click(screen.getByRole("button", { name: /run/i }));
    expect(screen.getByText(/run this tool/i)).toBeInTheDocument();
  });

  it("skips confirm and runs when tool.confirm === false", async () => {
    const tool: Tool = { id: "t", name: "T", command: "/x", confirm: false };
    const runner = mockRunner();
    wrap(tool, runner);
    await userEvent.click(screen.getByRole("button", { name: /run/i }));
    expect(runner.run).toHaveBeenCalledOnce();
  });

  it("passes typed values to the runner", async () => {
    const tool: Tool = {
      id: "t", name: "T", command: "/x", confirm: false,
      parameters: [
        { id: "fmt", label: "Format", type: "select", options: ["mp4", "webm"], default: "mp4" },
      ],
    };
    const runner = mockRunner();
    wrap(tool, runner);
    await userEvent.click(screen.getByRole("button", { name: /run/i }));
    await vi.waitFor(() => expect(runner.run).toHaveBeenCalled());
    expect(runner.run).toHaveBeenCalledWith(
      expect.objectContaining({ toolId: "t", values: { fmt: "mp4" } }),
      tool,
      undefined,
    );
  });

  it("hides advanced parameters until the disclosure is opened", async () => {
    const tool: Tool = {
      id: "t", name: "T", command: "/x",
      parameters: [
        { id: "input", label: "Video file", type: "file" },
        { id: "voice", label: "Voice model", type: "select", options: ["a", "b"], advanced: true, default: "a" },
      ],
    };
    wrap(tool, mockRunner());

    expect(screen.getByText("Video file")).toBeInTheDocument();
    const voiceLabelClosed = screen.getByText("Voice model");
    expect(voiceLabelClosed.closest("[aria-hidden='true']")).not.toBeNull();

    const summary = screen.getByRole("button", { name: /advanced options/i });
    await userEvent.click(summary);

    const voiceLabelOpen = screen.getByText("Voice model");
    expect(voiceLabelOpen.closest("[aria-hidden='true']")).toBeNull();
  });

  it("preserves advanced field values across collapse and re-expand", async () => {
    const tool: Tool = {
      id: "t", name: "T", command: "/x",
      parameters: [
        { id: "voice", label: "Voice model", type: "select", options: ["a", "b"], advanced: true, default: "a" },
      ],
    };
    wrap(tool, mockRunner());

    await userEvent.click(screen.getByRole("button", { name: /advanced options/i }));
    const select = screen.getByLabelText("voice") as HTMLSelectElement;
    await userEvent.selectOptions(select, "b");
    expect(select.value).toBe("b");

    // Collapse
    await userEvent.click(screen.getByRole("button", { name: /advanced options/i }));
    // Re-expand
    await userEvent.click(screen.getByRole("button", { name: /advanced options/i }));
    const select2 = screen.getByLabelText("voice") as HTMLSelectElement;
    expect(select2.value).toBe("b");
  });

  it("Run stays enabled when only advanced+optional fields are unset", () => {
    const tool: Tool = {
      id: "t", name: "T", command: "/x",
      parameters: [
        { id: "title", label: "Title", type: "text", advanced: true, optional: true },
      ],
    };
    wrap(tool, mockRunner());
    expect(screen.getByRole("button", { name: /^run$/i })).not.toBeDisabled();
  });
});
