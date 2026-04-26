import { Badge } from "../atoms/Badge";
import type { RunStatus } from "../../domain/runRequest";

const MAP: Record<RunStatus, { variant: "neutral" | "info" | "success" | "danger" | "warning"; text: string }> = {
  pending: { variant: "neutral", text: "Queued" },
  running: { variant: "info",    text: "Running…" },
  success: { variant: "success", text: "Done" },
  failed:  { variant: "danger",  text: "Failed" },
  killed:  { variant: "warning", text: "Stopped" },
};

export function RunStatusPill({ status }: { status: RunStatus }) {
  const { variant, text } = MAP[status];
  return (
    <Badge variant={variant}>
      {status === "running" && <span className="run-pill__dot" aria-hidden />}
      {text}
    </Badge>
  );
}
