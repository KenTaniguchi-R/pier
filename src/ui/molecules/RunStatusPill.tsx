import { Badge } from "../atoms/Badge";
import type { RunStatus } from "../../domain/runRequest";

const MAP: Record<RunStatus, { variant: "neutral" | "info" | "success" | "danger" | "warning"; text: string }> = {
  pending: { variant: "neutral", text: "QUEUED" },
  running: { variant: "info",    text: "RUNNING" },
  success: { variant: "success", text: "OK" },
  failed:  { variant: "danger",  text: "FAIL" },
  killed:  { variant: "warning", text: "KILLED" },
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
