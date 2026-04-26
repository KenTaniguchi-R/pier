import { getCurrentWebview } from "@tauri-apps/api/webview";
import { open } from "@tauri-apps/plugin-dialog";
import type { FilePicker, DragDropEvent } from "../application/ports";

export const tauriFilePicker: FilePicker = {
  onDragDrop(cb) {
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    getCurrentWebview()
      .onDragDropEvent(event => {
        const p = event.payload as { type: string; position?: { x: number; y: number }; paths?: string[] };
        let mapped: DragDropEvent | null = null;
        if (p.type === "over" || p.type === "enter") {
          if (p.position) mapped = { kind: "over", position: p.position };
        } else if (p.type === "leave") {
          mapped = { kind: "leave" };
        } else if (p.type === "drop") {
          mapped = { kind: "drop", paths: p.paths ?? [], position: p.position ?? { x: 0, y: 0 } };
        }
        if (mapped) cb(mapped);
      })
      .then(fn => {
        if (cancelled) fn();
        else unlisten = fn;
      })
      .catch(err => {
        console.error("onDragDropEvent failed:", err);
      });
    return () => {
      cancelled = true;
      unlisten?.();
    };
  },

  async pick({ directory, accepts }) {
    const filters = accepts?.length
      ? [{ name: "Allowed", extensions: accepts.map(a => a.replace(/^\*?\./, "")) }]
      : undefined;
    const result = await open({ multiple: false, directory: directory ?? false, filters });
    return typeof result === "string" ? result : null;
  },
};
