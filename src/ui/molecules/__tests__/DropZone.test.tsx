import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DropZone } from "../DropZone";

describe("DropZone", () => {
  it("calls onDrop with first dropped file path", () => {
    const onDrop = vi.fn();
    render(<DropZone onDrop={onDrop} accepts={["*.mp4"]} label="Drop a video here" />);
    const zone = screen.getByText("Drop a video here").closest(".dropzone")!;
    const file = new File(["x"], "a.mp4", { type: "video/mp4" });
    Object.defineProperty(file, "path", { value: "/tmp/a.mp4" });
    fireEvent.drop(zone, { dataTransfer: { files: [file] } });
    expect(onDrop).toHaveBeenCalledWith("/tmp/a.mp4");
  });

  it("ignores drop without files", () => {
    const onDrop = vi.fn();
    render(<DropZone onDrop={onDrop} />);
    const zone = screen.getByText(/drop a file/i).closest(".dropzone")!;
    fireEvent.drop(zone, { dataTransfer: { files: [] } });
    expect(onDrop).not.toHaveBeenCalled();
  });
});
