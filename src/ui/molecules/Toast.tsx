import { useEffect, type ReactNode } from "react";

interface Action { label: string; onClick: () => void }

interface Props {
  open: boolean;
  children: ReactNode;
  action?: Action;
  onDismiss?: () => void;
  variant?: "info" | "error";
}

export function Toast({ open, children, action, onDismiss, variant = "info" }: Props) {
  useEffect(() => {
    if (!open || !onDismiss) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onDismiss(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onDismiss]);

  if (!open) return null;

  const bg = variant === "error"
    ? "bg-danger-soft border-danger text-danger"
    : "bg-surface border-line text-ink";

  return (
    <div role="status" aria-live="polite"
         className={`fixed bottom-5 right-5 z-40 flex items-center gap-3 pl-4 pr-3 py-2.5 rounded-[12px] border shadow-pop animate-toast-in ${bg}`}>
      <div className="font-body text-[13px] leading-[1.4]">{children}</div>
      {action && (
        <button onClick={action.onClick} className="font-body font-semibold text-[12px] text-accent hover:underline px-2 py-1">
          {action.label}
        </button>
      )}
      {onDismiss && (
        <button onClick={onDismiss} aria-label="Dismiss" className="text-ink-3 hover:text-ink px-2 py-1">×</button>
      )}
    </div>
  );
}
