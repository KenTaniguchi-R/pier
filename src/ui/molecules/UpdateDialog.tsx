import { Button } from "../atoms/Button";
import { Markdown } from "../atoms/Markdown";
import { useDialogA11y } from "./useDialogA11y";
import { useUpdaterState } from "../../state/UpdaterStateContext";

interface Props { open: boolean; onClose: () => void }

export function UpdateDialog({ open, onClose }: Props) {
  const ctrl = useUpdaterState();
  const info =
    ctrl.state.kind === "ready" || ctrl.state.kind === "available" ? ctrl.state.info : null;

  const handleRemind = async () => { await ctrl.remindLater(); onClose(); };
  const panelRef = useDialogA11y({ open: open && !!info, onEscape: handleRemind });

  if (!open || !info) return null;

  const handleSkip = async () => { await ctrl.skip(); onClose(); };
  const handleInstall = async () => { await ctrl.install(); };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(31,26,22,0.32)] backdrop-blur-[4px] animate-overlay-in"
         role="dialog" aria-modal aria-labelledby="upd-title" aria-describedby="upd-sub">
      <div ref={panelRef} className="bg-surface border border-line rounded-[14px] w-[min(560px,calc(100%-32px))] max-h-[min(80vh,640px)] shadow-pop overflow-hidden animate-panel-in flex flex-col">
        <header className="px-6 pt-6 pb-3">
          <span className="block font-mono text-[10px] uppercase tracking-[0.18em] text-ink-3 mb-1">Update available</span>
          <h2 id="upd-title" className="font-display text-[22px] font-semibold text-ink tracking-[-0.005em]">
            A new version of Pier is available
          </h2>
          <p id="upd-sub" className="font-body text-[13px] text-ink-3 mt-1">
            Pier {info.version} is available — you have {info.currentVersion}.
          </p>
        </header>
        <div className="px-6 pb-4 flex-1 overflow-y-auto">
          {info.notes
            ? <Markdown source={info.notes} />
            : <p className="font-body text-[13px] text-ink-3 italic">No release notes provided.</p>}
        </div>
        <footer className="flex justify-end gap-2 px-6 py-3 border-t border-line bg-bg">
          <Button variant="ghost" onClick={handleSkip}>Skip This Version</Button>
          <Button variant="ghost" onClick={handleRemind}>Remind Me Later</Button>
          <Button variant="primary" onClick={handleInstall}>Install and Restart</Button>
        </footer>
      </div>
    </div>
  );
}
