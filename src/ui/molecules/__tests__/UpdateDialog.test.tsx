import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { UpdateDialog } from "../UpdateDialog";
import { UpdaterStateProvider } from "../../../state/UpdaterStateContext";
import { OpenerProvider } from "../../../state/OpenerContext";
import type { UpdateController } from "../../../application/useUpdater";

const opener = { open: async () => {} };

function ctrl(overrides: Partial<UpdateController> = {}): UpdateController {
  return {
    state: { kind: "ready", info: { version: "0.2.0", currentVersion: "0.1.0", notes: "## Hi", pubDate: null } },
    manualCheck: vi.fn(), install: vi.fn(),
    remindLater: vi.fn().mockResolvedValue(undefined),
    skip: vi.fn().mockResolvedValue(undefined),
    dismissError: vi.fn(),
    ...overrides,
  };
}

function R(c: UpdateController, onClose = vi.fn()) {
  return render(
    <OpenerProvider opener={opener}>
      <UpdaterStateProvider controller={c}>
        <UpdateDialog open onClose={onClose} />
      </UpdaterStateProvider>
    </OpenerProvider>,
  );
}

describe("UpdateDialog", () => {
  it("renders version line and notes", () => {
    R(ctrl());
    expect(screen.getByText(/0\.2\.0/)).toBeInTheDocument();
    expect(screen.getByText(/0\.1\.0/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: /A new version/i })).toBeInTheDocument();
  });
  it("Install button calls install()", () => {
    const c = ctrl();
    R(c);
    fireEvent.click(screen.getByRole("button", { name: "Install and Restart" }));
    expect(c.install).toHaveBeenCalled();
  });
  it("Skip button calls skip()", async () => {
    const c = ctrl();
    R(c);
    fireEvent.click(screen.getByRole("button", { name: "Skip This Version" }));
    await Promise.resolve(); await Promise.resolve();
    expect(c.skip).toHaveBeenCalled();
  });
  it("Remind button calls remindLater()", async () => {
    const c = ctrl();
    R(c);
    fireEvent.click(screen.getByRole("button", { name: "Remind Me Later" }));
    await Promise.resolve(); await Promise.resolve();
    expect(c.remindLater).toHaveBeenCalled();
  });
});
