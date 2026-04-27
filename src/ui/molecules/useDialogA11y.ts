import { useEffect, useRef } from "react";

interface Opts { open: boolean; onEscape: () => void }

export function useDialogA11y({ open, onEscape }: Opts) {
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<Element | null>(null);

  useEffect(() => {
    if (!open) return;
    triggerRef.current = document.activeElement;
    const panel = panelRef.current;
    if (!panel) return;

    const focusables = () =>
      Array.from(
        panel.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
        ),
      );
    const first = focusables()[0];
    if (first) first.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); onEscape(); return; }
      if (e.key === "Tab") {
        const items = focusables();
        if (items.length === 0) return;
        const f0 = items[0];
        const fn = items[items.length - 1];
        if (e.shiftKey && document.activeElement === f0) { e.preventDefault(); fn.focus(); }
        else if (!e.shiftKey && document.activeElement === fn) { e.preventDefault(); f0.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      const trigger = triggerRef.current as HTMLElement | null;
      if (trigger && typeof trigger.focus === "function") trigger.focus();
    };
  }, [open, onEscape]);

  return panelRef;
}
