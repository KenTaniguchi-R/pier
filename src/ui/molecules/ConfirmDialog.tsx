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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(31,26,22,0.32)] backdrop-blur-[4px] animate-overlay-in"
      role="dialog"
      aria-modal
    >
      <div className="bg-surface border border-line rounded-[14px] w-[min(440px,calc(100%-32px))] shadow-pop overflow-hidden animate-panel-in">
        <header className="px-6 pt-6 pb-3">
          <span className="block font-body font-medium text-[12px] leading-none text-ink-3 mb-1">
            Run this tool?
          </span>
          <h2 className="font-display text-[22px] font-semibold text-ink tracking-[-0.005em]">
            {toolName}
          </h2>
        </header>
        {shell && (
          <div className="mx-6 mb-3 px-3 py-2 bg-warning-soft border border-warning text-warning font-body font-medium text-[12px] leading-[1.4] rounded-[10px]">
            Heads up — this tool runs shell commands and can affect your files. Only continue if you trust where it came from.
          </div>
        )}
        <pre className="mx-6 mb-4 px-3 py-2 bg-bg-2 border border-line rounded-[10px] font-mono font-normal text-[12px] leading-[1.6] text-ink-2 whitespace-pre-wrap break-all">
          <span className="text-ink font-medium">{command}</span>
          {args.map((a, i) => (
            <span key={i} className="text-ink-3">{" "}{a}</span>
          ))}
        </pre>
        <footer className="flex justify-end gap-2 px-6 py-3 pb-4 border-t border-line bg-bg">
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button variant="primary" onClick={onConfirm}>Run</Button>
        </footer>
      </div>
    </div>
  );
}
