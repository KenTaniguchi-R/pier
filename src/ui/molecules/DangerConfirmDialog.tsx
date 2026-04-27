import { AlertTriangle } from "lucide-react";
import { Button } from "../atoms/Button";

interface Props {
  open: boolean;
  kicker?: string;
  title: string;
  message: string;
  confirmLabel: string;
  busyLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Generic destructive-action confirm. Used for irreversible operations like
 * clearing history. ConfirmDialog (run-shaped) is for tool runs specifically.
 */
export function DangerConfirmDialog({
  open,
  kicker = "Destructive",
  title,
  message,
  confirmLabel,
  busyLabel,
  busy = false,
  onConfirm,
  onCancel,
}: Props) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(31,26,22,0.32)] backdrop-blur-[4px] animate-overlay-in"
      role="dialog"
      aria-modal
    >
      <div className="bg-surface border border-line rounded-[14px] w-[min(440px,calc(100%-32px))] shadow-pop overflow-hidden animate-panel-in">
        <header className="px-6 pt-6 pb-2 flex items-start gap-3">
          <span className="flex-none mt-0.5 inline-flex items-center justify-center w-8 h-8 rounded-pill bg-danger-soft text-danger">
            <AlertTriangle size={16} strokeWidth={2} />
          </span>
          <div>
            <span className="block font-mono text-[10px] uppercase tracking-[0.18em] text-ink-3 mb-1">
              {kicker}
            </span>
            <h2 className="font-display text-[22px] font-semibold text-ink tracking-[-0.005em]">
              {title}
            </h2>
          </div>
        </header>
        <p className="px-6 pb-4 font-body text-[13px] leading-[1.55] text-ink-2">
          {message}
        </p>
        <footer className="flex justify-end gap-2 px-6 py-3 pb-4 border-t border-line bg-bg">
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm} disabled={busy}>
            {busy && busyLabel ? busyLabel : confirmLabel}
          </Button>
        </footer>
      </div>
    </div>
  );
}
