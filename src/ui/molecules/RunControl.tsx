import { Button } from "../atoms/Button";

interface Props {
  running: boolean;
  canRun: boolean;
  onRun: () => void;
  onStop: () => void;
}

export function RunControl({ running, canRun, onRun, onStop }: Props) {
  if (running) {
    return <Button variant="danger" onClick={onStop}>Stop</Button>;
  }

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
