import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DropZone } from "../DropZone";

describe("DropZone", () => {
  it("calls onDrop with first dropped file path", () => {
    const onDrop = vi.fn();
    render(<DropZone onDrop={onDrop} accepts={["*.mp4"]} label="// DROP VIDEO" />);
    const zone = screen.getByText("// DROP VIDEO").closest(".dropzone")!;
    const file = new File(["x"], "a.mp4", { type: "video/mp4" });
    Object.defineProperty(file, "path", { value: "/tmp/a.mp4" });
    fireEvent.drop(zone, { dataTransfer: { files: [file] } });
    expect(onDrop).toHaveBeenCalledWith("/tmp/a.mp4");
  });

  it("ignores drop without files", () => {
    const onDrop = vi.fn();
    render(<DropZone onDrop={onDrop} />);
    const zone = screen.getByText(/DROP/i).closest(".dropzone")!;
    fireEvent.drop(zone, { dataTransfer: { files: [] } });
    expect(onDrop).not.toHaveBeenCalled();
  });
});
