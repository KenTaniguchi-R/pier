# Pier — In-app updater

**Status:** Approved (v2 — incorporates senior dev + Tauri/macOS specialist + frontend/UX review)
**Date:** 2026-04-27

## Goals

- Pier checks for new releases on launch and every 24h after.
- When an update is available, Pier silently downloads it in the background and surfaces a non-modal indicator. The indicator is a **system notification** + a **tray-icon dot badge** when the main window is hidden, and an **in-app toast** when the window is visible.
- Clicking the indicator opens a Sparkle-style modal: title, current vs. new version, scrollable markdown changelog, three buttons:
  - **Install and Restart** (primary, right-most — matches existing dialog convention)
  - **Remind Me Later** — defers for 24h
  - **Skip This Version** — suppresses until a *newer* version appears
- A manual "Check for updates…" button lives in Settings, with auto-check toggle, last-checked timestamp, and current version.
- Errors are visible: a "Couldn't check for updates" inline message in Settings, plus an error variant of the toast for in-app failures with Retry.

## Non-goals

- Apple notarization (separate track).
- Staged/percentage rollouts.
- Beta/pre-release channels (single channel only — pre-release tags are intentionally invisible to the updater).
- In-app rollback.
- Delta updates (not supported by Tauri natively).
- Critical/forced-update flag (trivial future addition: `info.critical → hide Skip`).

## Distribution & infra

### Signing & ad-hoc codesign

1. Generate Tauri updater keypair: `tauri signer generate -w ~/.tauri/pier.key`. Public key → `tauri.conf.json`. Private key + password → GitHub Actions secrets.
2. **Ad-hoc codesign in CI is required** (not optional). On macOS 15+, an unsigned in-place app replacement can be blocked by Gatekeeper outright after the binary is overwritten, leaving the user with no recovery path. CI runs:
   ```
   codesign --force --deep --sign - Pier.app
   ```
   This doesn't satisfy notarization but stabilizes Gatekeeper across update cycles. (Apple notarization remains a non-goal but is the eventual upgrade path.)

### Updater plugin config

- `Cargo.toml`: add `tauri-plugin-updater = "2"`.
- `package.json`: add `@tauri-apps/plugin-updater`.
- `src-tauri/capabilities/default.json`: add `"updater:default"` permission. **Without this, the JS API silently fails.**
- `src-tauri/tauri.conf.json` → `plugins.updater`:
  ```json
  {
    "endpoints": ["https://github.com/<owner>/pier/releases/latest/download/latest.json"],
    "pubkey": "<embedded public key>"
  }
  ```
  Note: `/releases/latest/download/...` resolves to the latest **non-prerelease** tag — pre-releases are silently invisible. Acceptable per non-goals.

### Release workflow

GitHub Actions on tag `v*`:

- Runner: `macos-14` (pinned, arm64).
- Use `tauri-apps/tauri-action@v0` with `args: --target universal-apple-darwin` (universal binary; halves `latest.json` and avoids x64/arm64 selection bugs).
- Env: `TAURI_SIGNING_PRIVATE_KEY`, `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` → produces `.app.tar.gz` + `.sig`.
- **Explicit step**: ad-hoc codesign the `.app` before tarballing.
- **Explicit step**: assemble `latest.json` (read each `.sig`, template the JSON) and upload as a release asset alongside the artifact.

`latest.json` schema (Tauri v2 standard):

```json
{
  "version": "0.2.0",
  "pub_date": "2026-04-27T12:00:00Z",
  "notes": "## What's new\n- Markdown release notes here",
  "platforms": {
    "darwin-aarch64": {
      "signature": "<sig contents>",
      "url": "https://github.com/<owner>/pier/releases/download/v0.2.0/Pier_0.2.0_universal.app.tar.gz"
    },
    "darwin-x86_64": {
      "signature": "<sig contents>",
      "url": "https://github.com/<owner>/pier/releases/download/v0.2.0/Pier_0.2.0_universal.app.tar.gz"
    }
  }
}
```

(With a universal binary, both platform keys point at the same artifact.)

## Architecture

Pier already follows `domain → application → infrastructure → ui/state` on both sides. The updater plugs into the same layering.

### Backend (`src-tauri/src/`)

- **Plugin**: `tauri-plugin-updater = "2"`, plus `tauri-plugin-notification = "2"` for system notifications. Initialize both in `lib.rs`.
- **`domain/update.rs`** — pure types:
  ```rust
  pub struct UpdateInfo {
      pub version: String,
      pub current_version: String,
      pub notes: Option<String>,
      pub pub_date: Option<String>,
  }
  pub struct UpdateProgress { pub downloaded: u64, pub total: Option<u64> }
  ```
- **`application/update.rs`** — orchestrates `tauri_plugin_updater::UpdaterExt`:
  - `check(app) -> Result<Option<UpdateInfo>>` — calls `app.updater()?.check().await?`, maps to `UpdateInfo`.
  - `download_and_install(app) -> Result<()>` — **single combined call** (`update.download_and_install(on_chunk, on_finish).await?` then `app.restart()`). No cached `Update` handle on `AppState` (the previous design assumed `Update: Send + Sync + 'static`, which is not guaranteed and can fail to compile under `.manage()`). The trade-off is one extra check round-trip if the user delays install across an app restart — acceptable.
  - `is_translocated(app) -> bool` — checks if the running bundle path contains `AppTranslocation`. If true, refuse to update; surface a clear "move Pier to /Applications to enable updates" message.
- **`commands.rs`** — three shims:
  - `check_update_cmd() -> Option<UpdateInfo>`
  - `install_update_cmd() -> ()` (does check → download_and_install → restart in one call; progress streamed via `pier://update-progress`)
  - `is_translocated_cmd() -> bool`
- **`state.rs`** — **no changes**. Removed the `pending_update` field from the prior design.
- **`lib.rs`** — register plugins + commands in `invoke_handler!`. Drop the tray-icon handle explicitly before `app.restart()` to avoid a duplicate-tray flash on relaunch.

### Settings backwards-compat (Rust-side)

The previous design put the merge in the TS layer; that's wrong — `serde_json` deserializes server-side first and a missing field errors out before TS sees it. Fix at the source:

- `src-tauri/src/domain/settings.rs` (extend existing): add `update: UpdatePrefs` field with `#[serde(default)]`. Each field of `UpdatePrefs` also gets `#[serde(default)]`. Old `~/.pier/settings.json` files load with `update` populated from defaults.
- TS `tauriSettings.load()` keeps a defensive merge against `DEFAULT_SETTINGS` for tests/browser fallback (cheap belt-and-braces).

### Frontend (`src/`)

#### `domain/`

- **`domain/update.ts`** — pure types + helpers:
  ```ts
  export interface UpdateInfo {
    version: string;
    currentVersion: string;
    notes: string | null;
    pubDate: string | null;
  }
  export interface UpdateProgress { downloaded: number; total: number | null }

  export type UpdateState =
    | { kind: "idle" }
    | { kind: "checking" }
    | { kind: "available"; info: UpdateInfo }
    | { kind: "downloading"; info: UpdateInfo; progress: UpdateProgress }
    | { kind: "ready"; info: UpdateInfo }
    | { kind: "error"; message: string; lastInfo: UpdateInfo | null };

  export function shouldSkip(info: UpdateInfo, prefs: UpdatePrefs, now: number): boolean;
  export function dueForCheck(prefs: UpdatePrefs, now: number): boolean;
  ```

- **`domain/settings.ts`** — extend:
  ```ts
  export interface UpdatePrefs {
    autoCheck: boolean;
    skippedVersion: string | null;
    remindAfter: number | null;
    lastCheckedAt: number | null;
  }
  export interface Settings {
    launchAtLogin: boolean;
    update: UpdatePrefs;
  }
  ```
  `DEFAULT_SETTINGS.update = { autoCheck: true, skippedVersion: null, remindAfter: null, lastCheckedAt: null }`.

#### `application/`

- **`application/ports.ts`** — extend:
  ```ts
  export interface UpdateChecker {
    check(): Promise<UpdateInfo | null>;
    installAndRelaunch(onProgress: (p: UpdateProgress) => void): Promise<void>;
    isTranslocated(): Promise<boolean>;
  }
  ```
  Note: no separate `download` step — matches the Rust side. The combined call streams progress via callback.

- **`application/useUpdater.ts`** — hook owning the state machine:
  - Single source of truth for cadence: a short interval poll (every 15 minutes while window has focus, every 60 minutes when blurred) compares `now - lastCheckedAt > 24h`. **No `setInterval(check, 24h)` reliance** — JS timers drift across system sleep on macOS and Chromium throttles them in hidden WebViews.
  - Re-check on `window` focus event.
  - On a check that finds an update *and* `!shouldSkip`: transitions to `available`. **Auto-download is gated on `prefs.autoCheck`**: if true, transitions to `downloading` then `ready`; if false (or after a download error), stays at `available` until the user clicks Install. (This addresses the "silent auto-download" UX concern while preserving the default zero-friction flow.)
  - Returns `UpdateController { state, manualCheck, install, remindLater, skip, dismissError }`.
  - Guards: `manualCheck` is a no-op if `state.kind` is `checking`/`downloading`. `install` is a no-op unless `state.kind` is `ready` or `available`.
  - Cleanup: `useEffect` returns a teardown that clears the focus listener and the poll interval.

#### Settings concurrency

The previous design wrote `Settings` from two callers (`useSettings`, `useUpdater`) concurrently — last-write-wins races on the full struct. Fix:

- Add a Rust command `patch_settings_cmd(patch: PartialSettings)` that loads, merges, writes-atomically (write to `settings.json.tmp`, rename) under a `Mutex` on `AppState`. `PartialSettings` is `Settings` with all fields `Option`.
- `SettingsAdapter` gains `patch(patch: Partial<Settings>): Promise<Settings>` returning the post-merge state.
- Both `useSettings.setLaunchAtLogin` and `useUpdater`'s persistence calls go through `patch()`. `save()` is retained for full overwrites but no longer used by mutators.
- `browserSettings` (memory store): update its `patch` and full-`save` paths to merge correctly so tests don't silently drop the new `update` slice.

#### `infrastructure/`

- **`infrastructure/tauriUpdateChecker.ts`** — only file allowed to import `@tauri-apps/plugin-updater`. Implements `UpdateChecker`. Subscribes to `pier://update-progress` events for the progress callback.
- **`infrastructure/tauriSettings.ts`** — implement the new `patch` method. Defensive merge against `DEFAULT_SETTINGS` retained on `load`.

#### `state/`

- **`state/UpdaterContext.tsx`** — provides `UpdateChecker` (mirrors `RunnerContext`/`SettingsContext`).
- **`state/UpdaterStateContext.tsx`** — hoists the `UpdateController` returned by a single `useUpdater()` call so toast and dialog share state without prop-drilling.
- Browser fallback throws "not in Tauri" on every method (consistent pattern).

#### `ui/`

Atomic-design placement (corrected from v1):

- **`ui/atoms/Markdown.tsx`** — hand-rolled markdown renderer (~40 lines), no deps, returns React nodes — **no `dangerouslySetInnerHTML`**, zero XSS surface. Supports headings, lists, links (using existing `SafeLink` atom for `target="_blank" rel="noopener noreferrer"`), code blocks, inline code, emphasis, paragraphs. Replaces the `marked` + `dompurify` plan: ~50KB gz of deps for "render our own GitHub release notes" is overkill, and avoiding `dangerouslySetInnerHTML` is cleaner.
- **`ui/molecules/Toast.tsx`** — generic presentational primitive (`open`, `children`, `action`, `variant`, `onDismiss`). Bottom-right anchored, slide-up. ARIA: `role="status"`, `aria-live="polite"`. ESC-to-dismiss.
- **`ui/molecules/UpdateToast.tsx`** — wraps `Toast` with update-specific copy + click-to-open-dialog wiring.
- **`ui/molecules/UpdateDialog.tsx`** — moved from organisms. Sparkle-style modal. Peers (`ConfirmDialog`, `DangerConfirmDialog`) are molecules with the same shape; organisms are reserved for stateful multi-domain compositions like `ToolRunner`. Buttons: `[Skip This Version]  [Remind Me Later]  [Install and Restart]` (ghost / ghost / primary). Reuses the dialog shell pattern from `DangerConfirmDialog`. ESC = Remind Me Later.
- **`ui/pages/SettingsPage.tsx`** — new `SettingsSection kicker="03" label="Updates"`:
  - Row: "Automatic updates" → `Switch` bound to `prefs.autoCheck`
  - Row: "Current version" → `subtitle="0.x.y"`, no control. **Make `SettingsRow.control` optional.**
  - Row: "Last checked" → `subtitle="4 hours ago"` (relative time), `control={<Button>Check for updates…</Button>}`. Mirrors the existing run-history row pattern.
  - Inline error message (red text, dismissible) below the section when `state.kind === "error"` from the most recent manual check.

- **`App.tsx`** — wrap tree in `<UpdaterProvider>` + `<UpdaterStateProvider>`. Mount `<UpdateToast />` and `<UpdateDialog />` at root, both reading from `UpdaterStateContext`.

#### Hidden-window UX (menu-bar app)

For a tray-driven app, an in-app toast is invisible when the main window is hidden. Layered approach:

1. On `state` → `ready`, **fire a system notification** via `tauri-plugin-notification` ("Pier 0.2.0 is ready — click to install"). Notification click → bring window to front + open `UpdateDialog`.
2. **Tray icon dot badge**: ship a second monochrome template PNG with a small dot. Swap when state is `ready`; revert on dismiss/install.
3. In-app toast renders only when `window.isVisible()` is true. (Rust-side helper `is_window_visible_cmd` or a JS Tauri API call on mount.) Otherwise the in-app toast is suppressed in favor of the notification + badge.
4. **Do not auto-pop the window**. Matches Sparkle-disabled-by-default convention; users opted into a menu-bar app for a reason.

#### Accessibility (apply to all dialogs, including existing ConfirmDialog/DangerConfirmDialog as a sibling fix)

- Focus trap inside open dialog.
- Initial focus on primary action.
- Restore focus to triggering element on close.
- ESC closes (semantics: cancel for ConfirmDialog/DangerConfirmDialog; "Remind Me Later" for UpdateDialog).
- `aria-labelledby` → header h2 id; `aria-describedby` → version subhead id.
- Toast: `role="status"`, `aria-live="polite"` (not "assertive" — non-critical).

#### Tailwind v4 discipline (call-outs for the implementer)

- No `bg-opacity-*` — use slash modifier (`bg-accent/50`).
- No `tailwind.config.js`. New tokens go in `@theme` in `src/styles/tailwind.css`.
- For toast slide-in: define `--animate-toast-in` + `@keyframes toast-in` inside `@theme`. Use `animate-toast-in` utility — no inline `@keyframes` in components.
- Reuse existing tokens: overlay `bg-[rgba(31,26,22,0.32)] backdrop-blur-[4px] animate-overlay-in`, panel `bg-surface border border-line rounded-[14px] shadow-pop animate-panel-in`, easing `ease-(--ease-smooth)` (parens form).
- Markdown code blocks: `font-mono bg-bg-2 border border-line rounded-[10px]`.

### Data flow

```
launch
  → UpdaterProvider mounts → useUpdater() effect
    if !autoCheck: state=idle, set up focus+poll listeners, stop
    isTranslocated? → state=error("Move Pier to /Applications to enable updates"), stop
    dueForCheck(prefs, now)? → port.check()
      null               → state=idle, patch lastCheckedAt
      info && shouldSkip → state=idle, patch lastCheckedAt
      info               → state=available
                         if autoCheck: → port.installAndRelaunch(onProgress)
                                          chunked → state=downloading…
                                          done    → state=ready
                                          error   → state=error(msg, info)
                         else: stay at state=available

ready
  → if window hidden: fire system notification + swap tray icon to dot variant
  → if window visible: render <UpdateToast>

user clicks toast / notification
  → open <UpdateDialog>
    Install and Restart → port.installAndRelaunch() (or app.restart() if already ready)
    Remind Me Later     → patch({update:{remindAfter: now + 24h}}), state=idle, revert tray
    Skip This Version   → patch({update:{skippedVersion: info.version}}), state=idle, revert tray

manualCheck (Settings → "Check for updates…")
  → bypasses dueForCheck + shouldSkip; same downstream state machine.
  → on error: state=error, render inline message in Settings, offer Retry.
```

## Refactors bundled in

- `domain/settings.ts` gains a nested `update` slice.
- Rust `Settings` mirrors with `#[serde(default)]` on every new field — handles backwards-compat at the boundary.
- New `patch_settings_cmd` + `SettingsAdapter.patch` to serialize concurrent partial writes (race fix).
- `ui/molecules/SettingsRow` — make `control` optional.
- `ui/molecules/ConfirmDialog` + `DangerConfirmDialog` — apply the a11y checklist (focus trap, ESC, ARIA). Sibling fix because we're touching the same area.
- `ui/molecules/Toast` — new generic primitive (vs. one-off UpdateToast).
- New tray-icon "has-update" template PNG + Rust swap helper.
- Drop tray handle before `app.restart()` to avoid duplicate icon flash.

No changes to tool/run code, history, sidebar.

## Testing

**Frontend**

- `domain/__tests__/update.test.ts` — table-driven `shouldSkip` and `dueForCheck`, including: skipped equal/older/newer/null, autoCheck off, never checked, within 24h, past 24h, remindAfter past/future.
- `application/__tests__/useUpdater.test.tsx` — fake `UpdateChecker` + fake `SettingsAdapter`; assert:
  - auto-check on mount → ready
  - auto-check + autoCheck=false → state=available, no auto-download
  - skipped version → idle
  - remindAfter in future → idle
  - manual check ignores skip + remind
  - download failure → error state with `lastInfo` preserved → dismissError → idle
  - install failure → error state → user can retry
  - manualCheck during ongoing download → no-op (guard test)
  - translocated bundle → error state on launch
  - effect teardown clears interval + focus listener (timer-leak test)
  - Skip persists `skippedVersion` via `patch`; Remind persists `remindAfter`
- `application/__tests__/settings_patch.test.ts` — concurrent `patch` calls produce merged result, no field loss.
- `ui/atoms/__tests__/Markdown.test.tsx` — heading/list/link/code rendering; no `<script>` execution path exists (no `dangerouslySetInnerHTML`); `SafeLink` used for external links.
- `ui/molecules/__tests__/Toast.test.tsx` — renders only when `open`; ESC dismisses; ARIA roles.
- `ui/molecules/__tests__/UpdateToast.test.tsx` — visible only when `state.kind === "ready"` *and* window visible.
- `ui/molecules/__tests__/UpdateDialog.test.tsx` — version line, focus trap, ESC = Remind Me Later, button → controller method binding, restore focus on close.

**Backend**

- `application/update::is_translocated` — unit test with a fake bundle path.
- `application/settings::patch` — unit test for atomic-rename + merge correctness; deserializes old JSON without `update` field via `#[serde(default)]`.
- Tauri-side `update.rs` happy-path stays manual-smoke (build a tagged release on a test repo, install old version, observe).

## Acceptance

- Tagging `v0.2.0` produces a GitHub Release with universal `.app.tar.gz`, `.sig`, ad-hoc-codesigned, and `latest.json`.
- A Pier 0.1.0 install on launch: silently downloads 0.2.0; window-hidden case fires a system notification + tray dot badge; window-visible case shows toast.
- Skip persists across restarts; Remind silences for 24h; Install relaunches into 0.2.0.
- Translocated bundle shows actionable error and never attempts replace.
- Manual "Check for updates…" works at any time and surfaces errors inline.
- Concurrent toggles (autoCheck + background skipped-version write) never lose either field.
- Settings file from before the feature loads cleanly with default `update` slice.
- After an update, the app launches without a duplicate tray icon and Gatekeeper does not block the new bundle.
