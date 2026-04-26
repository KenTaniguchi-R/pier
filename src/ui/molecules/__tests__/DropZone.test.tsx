import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DropZone } from "../DropZone";
import { FilePickerProvider } from "../../../state/FilePickerContext";
import type { FilePicker, DragDropEvent } from "../../../application/ports";

function makePicker() {
  let handler: ((e: DragDropEvent) => void) | null = null;
  const pick = vi.fn<FilePicker["pick"]>(async () => null);
  const picker: FilePicker = {
    onDragDrop(cb) {
      handler = cb;
      return () => { handler = null; };
    },
    pick,
  };
  return { picker, fire: (e: DragDropEvent) => handler?.(e), pick };
}

describe("DropZone", () => {
  it("calls onDrop when a native drop fires inside the zone", () => {
    const onDrop = vi.fn();
    const { picker, fire } = makePicker();
    render(
      <FilePickerProvider picker={picker}>
        <DropZone onDrop={onDrop} accepts={["mp4"]} label="Drop a video here" />
      </FilePickerProvider>,
    );
    const zone = screen.getByText("Drop a video here").closest(".dropzone")! as HTMLElement;
    vi.spyOn(zone, "getBoundingClientRect").mockReturnValue({
      left: 0, top: 0, right: 100, bottom: 100, width: 100, height: 100, x: 0, y: 0, toJSON: () => ({}),
    } as DOMRect);
    fire({ kind: "drop", paths: ["/tmp/a.mp4"], position: { x: 50, y: 50 } });
    expect(onDrop).toHaveBeenCalledWith("/tmp/a.mp4");
  });

  it("ignores drops outside the zone", () => {
    const onDrop = vi.fn();
    const { picker, fire } = makePicker();
    render(
      <FilePickerProvider picker={picker}>
        <DropZone onDrop={onDrop} />
      </FilePickerProvider>,
    );
    const zone = screen.getByText(/drop a file/i).closest(".dropzone")! as HTMLElement;
    vi.spyOn(zone, "getBoundingClientRect").mockReturnValue({
      left: 0, top: 0, right: 100, bottom: 100, width: 100, height: 100, x: 0, y: 0, toJSON: () => ({}),
    } as DOMRect);
    fire({ kind: "drop", paths: ["/tmp/x"], position: { x: 500, y: 500 } });
    expect(onDrop).not.toHaveBeenCalled();
  });

  it("opens the native picker on click and forwards the chosen path", async () => {
    const onDrop = vi.fn();
    const { picker, pick } = makePicker();
    pick.mockResolvedValueOnce("/tmp/picked.mp4");
    render(
      <FilePickerProvider picker={picker}>
        <DropZone onDrop={onDrop} accepts={["mp4"]} />
      </FilePickerProvider>,
    );
    const zone = screen.getByText(/drop a file/i).closest(".dropzone")! as HTMLElement;
    fireEvent.click(zone);
    await vi.waitFor(() => expect(onDrop).toHaveBeenCalledWith("/tmp/picked.mp4"));
    expect(pick).toHaveBeenCalledWith({ directory: undefined, accepts: ["mp4"] });
  });
});
