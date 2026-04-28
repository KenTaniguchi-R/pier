import type { RecentToolRun } from "../../application/ports";

const TONE: Record<RecentToolRun["lastStatus"], string> = {
  success: "bg-success",
  failed: "bg-danger",
  killed: "bg-ink-4",
  running: "bg-accent animate-run-pulse",
};

export function StatusDot({ status }: { status: RecentToolRun["lastStatus"] }) {
  return (
    <span
      aria-label={`Last run: ${status}`}
      className={`inline-block w-1.5 h-1.5 rounded-full ${TONE[status]}`}
    />
  );
}
