import type { RunStatus } from "../../domain/runRequest";

export interface RunStatusStyle {
  label: string;
  text: string;
  edge: string;
  /** Background-color utility for the StatusDot atom. */
  dot: string;
}

export const RUN_STATUS_STYLE: Record<RunStatus, RunStatusStyle> = {
  pending: { label: "Pending",   text: "text-ink-3",   edge: "border-l-line",      dot: "bg-line-hi" },
  running: { label: "Streaming", text: "text-warning", edge: "border-l-warning",   dot: "bg-accent animate-run-pulse" },
  success: { label: "Done",      text: "text-success", edge: "border-l-success",   dot: "bg-success" },
  failed:  { label: "Failed",    text: "text-danger",  edge: "border-l-danger",    dot: "bg-danger" },
  killed:  { label: "Cancelled", text: "text-ink-3",   edge: "border-l-ink-4",     dot: "bg-ink-4" },
};
