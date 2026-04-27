import { useState } from "react";
import { Toast } from "./Toast";
import { useUpdaterState } from "../../state/UpdaterStateContext";
import { UpdateDialog } from "./UpdateDialog";

export function UpdateToast() {
  const ctrl = useUpdaterState();
  const [open, setOpen] = useState(false);

  if (ctrl.state.kind === "ready") {
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
  if (ctrl.state.kind === "error" && ctrl.state.lastInfo) {
    return (
      <Toast open variant="error" action={{ label: "Retry", onClick: () => ctrl.install() }} onDismiss={ctrl.dismissError}>
        Update failed: {ctrl.state.message}
      </Toast>
    );
  }
  return null;
}
