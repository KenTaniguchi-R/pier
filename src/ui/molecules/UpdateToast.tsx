import { useEffect, useState } from "react";
import { Toast } from "./Toast";
import { useUpdaterState } from "../../state/UpdaterStateContext";
import { useUpdateChecker } from "../../state/UpdaterContext";
import { UpdateDialog } from "./UpdateDialog";

function useWindowVisible(): boolean {
  const checker = useUpdateChecker();
  const [v, setV] = useState(true);
  useEffect(() => {
    let cancelled = false;
    checker.isWindowVisible().then((initial) => { if (!cancelled) setV(initial); });
    const unsub = checker.onWindowVisibilityChange(setV);
    return () => { cancelled = true; unsub(); };
  }, [checker]);
  return v;
}

export function UpdateToast() {
  const ctrl = useUpdaterState();
  const [open, setOpen] = useState(false);
  const visible = useWindowVisible();

  if (ctrl.state.kind === "ready" && visible) {
    const info = ctrl.state.info;
    return (
      <>
        <Toast open={!open} action={{ label: "View", onClick: () => setOpen(true) }}>
          Pier {info.version} is ready
        </Toast>
        <UpdateDialog open={open} onClose={() => setOpen(false)} />
      </>
    );
  }
  if (ctrl.state.kind === "error" && ctrl.state.lastInfo && visible) {
    return (
      <Toast open variant="error" action={{ label: "Retry", onClick: () => ctrl.install() }} onDismiss={ctrl.dismissError}>
        Update failed: {ctrl.state.message}
      </Toast>
    );
  }
  if (ctrl.state.kind === "ready") {
    return <UpdateDialog open={open} onClose={() => setOpen(false)} />;
  }
  return null;
}
