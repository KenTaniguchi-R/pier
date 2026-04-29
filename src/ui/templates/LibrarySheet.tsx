import { useApp } from "../../state/AppContext";
import { LibraryBrowser } from "../organisms/LibraryBrowser";
import { useDialogA11y } from "../molecules/useDialogA11y";

export function LibrarySheet() {
  const { state, dispatch } = useApp();
  const close = () => dispatch({ type: "LIBRARY_SHEET_CLOSE" });
  const panelRef = useDialogA11y({ open: state.librarySheetOpen, onEscape: close });

  if (!state.librarySheetOpen) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Library"
      className="fixed inset-0 z-40 bg-ink/12 backdrop-blur-sm animate-overlay-in"
    >
      <div
        ref={panelRef}
        className="
          absolute inset-x-0 bottom-0 top-12
          bg-bg border-t border-line rounded-t-3 shadow-pop
          flex flex-col animate-panel-in overflow-hidden
        "
      >
        <header className="px-8 py-4 border-b border-line flex items-center justify-between">
          <div className="flex items-baseline gap-3">
            <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink-3">
              Pier
            </span>
            <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink-4">
              /
            </span>
            <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink">
              Library
            </span>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close library"
            className="
              text-[18px] leading-none text-ink-3 hover:text-ink
              w-7 h-7 grid place-items-center rounded-1
              transition-colors
              focus:outline-none focus:bg-bg-2
            "
          >
            ×
          </button>
        </header>
        <div className="flex-1 overflow-auto">
          <LibraryBrowser />
        </div>
      </div>
    </div>
  );
}
