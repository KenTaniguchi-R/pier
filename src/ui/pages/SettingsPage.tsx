import { useState } from "react";
import { Power, Trash2 } from "lucide-react";
import { Button } from "../atoms/Button";
import { Switch } from "../atoms/Switch";
import { SettingsSection } from "../molecules/SettingsSection";
import { SettingsRow } from "../molecules/SettingsRow";
import { DangerConfirmDialog } from "../molecules/DangerConfirmDialog";
import { formatBytes } from "../molecules/formatBytes";
import { useSettings } from "../../application/useSettings";

function historyStatus(stats: ReturnType<typeof useSettings>["stats"]): string {
  if (!stats) return "—";
  if (stats.runCount === 0) return "Nothing stored";
  const noun = stats.runCount === 1 ? "run" : "runs";
  return `${stats.runCount.toLocaleString()} ${noun} · ${formatBytes(stats.bytes)}`;
}

export function SettingsPage() {
  const {
    settings, stats,
    setLaunchAtLogin, savingLogin,
    clearHistory, clearing, justCleared,
  } = useSettings();
  const [confirming, setConfirming] = useState(false);

  const onConfirmClear = async () => {
    await clearHistory();
    setConfirming(false);
  };

  return (
    <div className="min-h-full bg-bg">
      <header className="px-10 pt-10 pb-6 max-w-[720px] mx-auto">
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-4 mb-3">
          PIER · PREFERENCES
        </div>
        <h1 className="font-display text-[44px] leading-[1.05] tracking-[-0.015em] text-ink font-semibold">
          Settings
        </h1>
        <div className="mt-7 mb-1 flex items-center gap-3 text-ink-3" aria-hidden>
          <span className="h-px flex-1 bg-line" />
          <span className="font-display italic text-[14px]">§</span>
          <span className="h-px flex-1 bg-line" />
        </div>
      </header>

      <div className="px-10 pb-16 max-w-[720px] mx-auto flex flex-col gap-8">
        <SettingsSection kicker="01" label="Behavior">
          <SettingsRow
            icon={<Power size={16} strokeWidth={1.75} />}
            title="Launch at login"
            control={
              <Switch
                checked={settings.launchAtLogin}
                onChange={setLaunchAtLogin}
                disabled={savingLogin}
                label="Launch at login"
              />
            }
          />
        </SettingsSection>

        <SettingsSection kicker="02" label="Data">
          <SettingsRow
            icon={<Trash2 size={16} strokeWidth={1.75} />}
            title="Run history"
            subtitle={historyStatus(stats)}
            control={
              <Button
                variant="ghost"
                onClick={() => setConfirming(true)}
                disabled={!stats || stats.runCount === 0 || clearing}
              >
                {justCleared ? "Cleared ✓" : "Clear…"}
              </Button>
            }
          />
        </SettingsSection>
      </div>

      <DangerConfirmDialog
        open={confirming}
        title="Clear all run history?"
        message={
          (stats
            ? `${stats.runCount.toLocaleString()} run${stats.runCount === 1 ? "" : "s"} (${formatBytes(stats.bytes)})`
            : "Stored runs") +
          " will be deleted. Tools and settings are untouched."
        }
        confirmLabel="Clear history"
        busyLabel="Clearing…"
        busy={clearing}
        onConfirm={onConfirmClear}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}
