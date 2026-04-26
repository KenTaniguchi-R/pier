import { Button } from "../atoms/Button";

interface Props {
  open: boolean;
  toolName: string;
  command: string;
  args: string[];
  shell?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ open, toolName, command, args, shell, onConfirm, onCancel }: Props) {
  if (!open) return null;
  return (
    <div className="confirm-overlay" role="dialog" aria-modal>
      <div className="confirm-panel">
        <header className="confirm-panel__head">
          <span className="confirm-panel__eyebrow">Run this tool?</span>
          <h2 className="confirm-panel__title">{toolName}</h2>
        </header>
        {shell && (
          <div className="confirm-panel__warn">
            Heads up — this tool runs shell commands and can affect your files. Only continue if you trust where it came from.
          </div>
        )}
        <pre className="confirm-panel__cmd">
          <span className="confirm-panel__cmd-bin">{command}</span>
          {args.map((a, i) => (
            <span key={i} className="confirm-panel__cmd-arg">{" "}{a}</span>
          ))}
        </pre>
        <footer className="confirm-panel__foot">
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button variant="primary" onClick={onConfirm}>Run</Button>
        </footer>
      </div>
    </div>
  );
}
