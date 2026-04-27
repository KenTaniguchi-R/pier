import { useMemo, useState } from "react";
import { Download, GitBranch, Power, Trash2 } from "lucide-react";
import { getVersion } from "@tauri-apps/api/app";
import { Button } from "../atoms/Button";
import { Switch } from "../atoms/Switch";
import { SettingsSection } from "../molecules/SettingsSection";
import { SettingsRow } from "../molecules/SettingsRow";
import { DangerConfirmDialog } from "../molecules/DangerConfirmDialog";
import { formatBytes } from "../molecules/formatBytes";
import { useSettings } from "../../application/useSettings";
import { useUpdaterState } from "../../state/UpdaterStateContext";

function historyStatus(stats: ReturnType<typeof useSettings>["stats"]): string {
  if (!stats) return "—";
  if (stats.runCount === 0) return "Nothing stored";
  const noun = stats.runCount === 1 ? "run" : "runs";
  return `${stats.runCount.toLocaleString()} ${noun} · ${formatBytes(stats.bytes)}`;
}

function relativeTime(ts: number | null): string {
  if (!ts) return "Never";
  const diff = Date.now() - ts;
  if (diff < 0) return "Just now";
  const sec = Math.floor(diff / 1000);
  if (sec < 45) return "Just now";
  const min = Math.floor(sec / 60);
  if (min < 2) return "1 minute ago";
  if (min < 60) return `${min} minutes ago`;
  const hr = Math.floor(min / 60);
  if (hr < 2) return "1 hour ago";
  if (hr < 24) return `${hr} hours ago`;
  const day = Math.floor(hr / 24);
  if (day < 2) return "Yesterday";
  if (day < 30) return `${day} days ago`;
  return new Date(ts).toLocaleDateString();
}

export function SettingsPage() {
  const {
    settings, stats,
    setLaunchAtLogin, savingLogin,
    setAutoCheck,
    clearHistory, clearing, justCleared,
  } = useSettings();
  const updater = useUpdaterState();
  const [confirming, setConfirming] = useState(false);
  const [version, setVersion] = useState<string>("…");
  useMemo(() => { getVersion().then(setVersion).catch(() => setVersion("?")); }, []);

  const onConfirmClear = async () => {
    await clearHistory();
    setConfirming(false);
  };

  const checkLabel =
    updater.state.kind === "checking" ? "Checking…" :
    updater.state.kind === "downloading" ? "Downloading…" :
    "Check for updates…";

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

        <SettingsSection kicker="03" label="Updates">
          <SettingsRow
            icon={<Download size={16} strokeWidth={1.75} />}
            title="Automatic updates"
            control={
              <Switch
                checked={settings.update.autoCheck}
                onChange={setAutoCheck}
                label="Automatic updates"
              />
            }
          />
          <SettingsRow
            icon={<GitBranch size={16} strokeWidth={1.75} />}
            title="Current version"
            subtitle={version}
          />
          <SettingsRow
            icon={<Download size={16} strokeWidth={1.75} />}
            title="Last checked"
            subtitle={relativeTime(settings.update.lastCheckedAt)}
            control={
              <Button
                variant="ghost"
                onClick={() => updater.manualCheck()}
                disabled={updater.state.kind === "checking" || updater.state.kind === "downloading"}
              >
                {checkLabel}
              </Button>
            }
          />
        </SettingsSection>

        {updater.state.kind === "error" && (
          <div className="rounded-2 bg-danger/10 border border-danger/30 px-4 py-3 text-[13px] text-danger flex items-start justify-between gap-4">
            <span>{updater.state.message}</span>
            <button
              type="button"
              onClick={() => updater.dismissError()}
              className="underline underline-offset-2 hover:no-underline shrink-0"
            >
              Dismiss
            </button>
          </div>
        )}
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
