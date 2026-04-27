import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToolRunner } from "../ToolRunner";
import type { Parameter } from "../../../domain/tool";

describe("ToolRunner (dumb form)", () => {
  it("renders DropZone for a file parameter", () => {
    const params: Parameter[] = [{ id: "input", label: "Input file", type: "file" }];
    render(<ToolRunner params={params} values={{ input: "" }} onChange={() => {}} />);
    expect(screen.getByText(/drop a file/i)).toBeInTheDocument();
  });

  it("emits onChange with the typed value", async () => {
    const params: Parameter[] = [{ id: "name", label: "Name", type: "text" }];
    const onChange = vi.fn();
    render(<ToolRunner params={params} values={{ name: "" }} onChange={onChange} />);
    const input = screen.getByRole("textbox");
    await userEvent.type(input, "x");
    expect(onChange).toHaveBeenLastCalledWith("name", "x");
  });

  it("hides advanced parameters until the disclosure is opened", async () => {
    const params: Parameter[] = [
      { id: "input", label: "Video file", type: "file" },
      { id: "voice", label: "Voice model", type: "select", options: ["a", "b"], advanced: true, default: "a" },
    ];
    render(<ToolRunner params={params} values={{ input: "", voice: "a" }} onChange={() => {}} />);

    expect(screen.getByText("Video file")).toBeInTheDocument();
    const voiceLabelClosed = screen.getByText("Voice model");
    expect(voiceLabelClosed.closest("[aria-hidden='true']")).not.toBeNull();

    const summary = screen.getByRole("button", { name: /advanced options/i });
    await userEvent.click(summary);

    const voiceLabelOpen = screen.getByText("Voice model");
    expect(voiceLabelOpen.closest("[aria-hidden='true']")).toBeNull();
  });
});
