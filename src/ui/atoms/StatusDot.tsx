import type { RunStatus } from "../../domain/runRequest";
import { RUN_STATUS_STYLE } from "../molecules/runStatusStyle";

export function StatusDot({ status }: { status: RunStatus }) {
  return (
    <span
      aria-label={`Last run: ${RUN_STATUS_STYLE[status].label}`}
      className={`inline-block w-1.5 h-1.5 rounded-full ${RUN_STATUS_STYLE[status].dot}`}
    />
  );
}
