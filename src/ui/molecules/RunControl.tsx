import { Button } from "../atoms/Button";

interface Props {
  running: boolean;
  canRun: boolean;
  onRun: () => void;
  onStop: () => void;
  /** Short label naming what's missing — shown when canRun is false. */
  blockedReason?: string;
}

export function RunControl({ running, canRun, onRun, onStop, blockedReason }: Props) {
  if (running) {
    return <Button variant="danger" onClick={onStop}>Stop</Button>;
  }

  if (!canRun && blockedReason) {
    return (
      <Button variant="primary" disabled aria-label={`Cannot run: ${blockedReason}`}>
        {blockedReason}
      </Button>
    );
  }

  // The blocked branch above renders a different element subtree, so React
  // remounts this Button when canRun flips true — letting `animate-run-ready`
  // fire once on each transition into the ready state.
  return (
    <Button
      variant="primary"
      disabled={!canRun}
      onClick={onRun}
      className="animate-run-ready"
    >
      Run
    </Button>
  );
}
