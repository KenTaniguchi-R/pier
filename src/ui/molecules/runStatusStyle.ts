import type { RunStatus } from "../../domain/runRequest";

export interface RunStatusStyle {
  label: string;
  text: string;
  edge: string;
}

export const RUN_STATUS_STYLE: Record<RunStatus, RunStatusStyle> = {
  pending: { label: "Pending",   text: "text-ink-3",   edge: "border-l-line" },
  running: { label: "Streaming", text: "text-warning", edge: "border-l-warning" },
  success: { label: "Done",      text: "text-success", edge: "border-l-success" },
  failed:  { label: "Failed",    text: "text-danger",  edge: "border-l-danger" },
  killed:  { label: "Cancelled", text: "text-ink-3",   edge: "border-l-ink-4" },
};
