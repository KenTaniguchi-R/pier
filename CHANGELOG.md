# Changelog

All notable changes to Pier are documented here.

## v0.2.0 — 2026-04-27

### Added
- **In-app updater.** Pier checks for new releases on launch and every 24 hours, silently downloads them in the background, and surfaces a Sparkle-style modal with release notes plus three buttons: **Install and Restart**, **Remind Me Later** (24h), and **Skip This Version**. A manual "Check for updates…" button lives in Settings.
- **Hidden-window UX for menu-bar mode.** When the main window is hidden (tray-only), Pier fires a system notification and swaps the tray icon to a dot-badge variant instead of showing the in-app toast.
- **Updates section in Settings.** Toggle automatic updates, see the current version, see when the last check ran, and trigger a manual check. Errors render inline.
- **Translocation guard.** If Pier is launched from a translocated bundle path (e.g., DMG), updates are refused with an actionable message.
- **Atomic settings writes.** New `patch_settings_cmd` serializes concurrent partial writes through a lock with a tmp-file rename, eliminating last-write-wins races between auto-check persistence and user toggles.
- **Dialog accessibility.** Focus trap, ESC-to-cancel, and ARIA labelling applied to all modal dialogs (`ConfirmDialog`, `DangerConfirmDialog`, `UpdateDialog`).

### Changed
- Settings file (`~/.pier/settings.json`) now stores an `update` slice. Existing files load with safe defaults via `#[serde(default)]`.

### CI
- Tagged-release pipeline (`.github/workflows/release.yml`): macOS arm64 runner, universal binary via `tauri-action`, ad-hoc codesign, signed `.app.tar.gz` + `.sig`, and `latest.json` assembly uploaded to the GitHub Release.

## v0.1.0 — 2026-04-26

Initial unsigned DMG release. Tray-icon menu-bar app, tool runner with confirmation dialogs, run history, settings (launch at login, clear history).
