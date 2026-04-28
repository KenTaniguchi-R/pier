# Favorites Bar + Recent Runs (v1) — Design Spec

**Date:** 2026-04-27
**Status:** Approved (brainstorm complete)
**Scope:** Pier v1 first item — pinned tools and a cross-tool recent-runs strip on the Home view.

## 1. Goals

- Re-launching frequent tools should be one click from the default Home view.
- The user should see *what they ran recently* without drilling into per-tool history.
- Implementation must extend, not replace, current clean-architecture layering and the existing Tailwind v4 token system.

## 2. Non-goals

- Drag-to-reorder favorites (v1.1)
- Cross-tool deep history page (per-tool `HistoryList` already covers forensics)
- Keyboard launch shortcuts
- Cloud sync of favorites

## 3. UX

Two horizontal strips render above the existing `ToolBrowser` grid on the Home view, **only** when `selection.kind === "all"` and the search query is empty. Filtering by category or searching hides both strips so the user's current intent is the only thing on screen.

### Favorites bar

- Always rendered when on Home/all-tools, even when empty.
- Cap: 8 tools.
- Order: pin time, oldest-first (newest pin appended at the right).
- Empty state: italic hint "Star a tool to pin it here ★".
- When the cap is reached, `StarButton` is disabled on non-pinned tiles with tooltip "Unpin one to add another".

### Recent runs strip

- Rendered only when ≥1 distinct tool has run history. Hidden on first launch.
- Cap: 6 tiles.
- Tool-centric (dedup by `toolId`); newest run wins.
- Each tile: tool name + `StatusDot` (last run status) + relative time ("2m ago").
- Click → opens `ToolDetail` for that tool.

### Pinning affordance

- `StarButton` (top-right of `ToolCard`, inline next to title in `ToolDetail`).
- Visible-on-hover when not pinned; always visible when pinned.
- Click toggles; stops propagation so the card itself doesn't navigate.

## 4. Architecture

Extends the existing `domain → application → infrastructure → ui` stack. No new architectural concept introduced.

### 4.1 Domain

**`src/domain/settings.ts`** — extend `Settings`:
```ts
export interface Settings {
  launchAtLogin: boolean;
  update: UpdatePrefs;
  favorites: string[]; // tool ids, ordered by pin time
}
export const DEFAULT_SETTINGS: Settings = {
  launchAtLogin: false,
  update: DEFAULT_UPDATE_PREFS,
  favorites: [],
};
```

**`src-tauri/src/domain/settings.rs`** — mirror, with `#[serde(default)]` on `favorites` so older settings files load cleanly.

**`src/domain/favorites.ts`** (new, ~30 LOC, pure):
```ts
export const FAVORITES_CAP = 8;
export function isPinned(list: readonly string[], id: string): boolean
export function togglePin(list: readonly string[], id: string, cap = FAVORITES_CAP): string[]
export function pruneMissing(list: readonly string[], known: ReadonlySet<string>): string[]
```
- `togglePin`: removes if present; else appends if under cap; else returns unchanged (UI is responsible for disabling at cap).
- `pruneMissing`: filters out ids no longer in `tools.json`. Used at *read* time only — never persists prunes (config is hot-reloadable, missing tools may return).

### 4.2 Application

**`src/application/ports.ts`** — extend `HistoryReader`:
```ts
export interface RecentToolRun {
  toolId: string;
  lastRunAt: number;          // epoch ms
  lastStatus: "success" | "failed" | "killed" | "running";
}
export interface HistoryReader {
  list(toolId: string, limit?: number): Promise<RunSummary[]>;
  readOutput(outputPath: string): Promise<RunLogLine[]>;
  listRecentTools(limit: number): Promise<RecentToolRun[]>;
}
```

**`src-tauri/src/application/history.rs`** — add:
```rust
pub fn list_recent_tools(limit: usize) -> Result<Vec<RecentToolRun>>
pub fn list_recent_tools_in(audit: &Path, limit: usize) -> Result<Vec<RecentToolRun>>
```
Single scan of `~/.pier/audit.log`. For each `end` event, keep the newest record per `tool_id`. Sort desc by `ended_at`, truncate to `limit`. `start`-only entries (still running) are included with `status = "running"` if no end seen for that tool.

**`src-tauri/src/commands.rs`** — new `#[tauri::command] list_recent_tools_cmd(limit: usize) -> Result<Vec<RecentToolRun>, String>`. Wired into `invoke_handler!` in `lib.rs`.

**`src/state/useFavorites.ts`** (new):
```ts
export function useFavorites(): {
  favorites: string[];          // pruned against state.tools
  isPinned: (id: string) => boolean;
  toggle: (id: string) => Promise<void>;
  atCap: boolean;
}
```
Reads from `SettingsContext`, writes via `SettingsAdapter.patch({ favorites })`. Pruning happens on read; the saved list is preserved.

**`src/state/useRecentTools.ts`** (new) — mirrors `useToolHistory` exactly:
```ts
export function useRecentTools(limit = 6): {
  tools: RecentToolRun[];       // joined-with-state filtering omitted here; UI joins
  loading: boolean;
  refresh: () => void;
}
```
Subscribes to `runner.onExit` to refresh.

### 4.3 Infrastructure

**`src/infrastructure/tauriHistoryReader.ts`** — implement `listRecentTools` by invoking `list_recent_tools_cmd`.

No other infra changes. No new Tauri plugin.

### 4.4 UI (atomic)

| Layer | File | Purpose |
|---|---|---|
| atom | `ui/atoms/StarButton.tsx` | Pin toggle. `Star` from lucide; filled vs outline. |
| atom | `ui/atoms/StatusDot.tsx` | 6px semantic dot (success/failed/killed/running). |
| molecule | `ui/molecules/QuickTile.tsx` | Compact tile shared by both strips. Slots: `title`, `subtitle`, `trailing`. |
| organism | `ui/organisms/FavoritesBar.tsx` | Header + tiles + empty hint. |
| organism | `ui/organisms/RecentRunsStrip.tsx` | Header + tiles. Hidden when empty. |
| organism | `ui/organisms/HomeAllTools.tsx` | Composes strips + `ToolBrowser`. |

**Modified UI:**
- `ui/organisms/ToolCard.tsx` — absolutely-positioned `StarButton` top-right. Click `stopPropagation`.
- `ui/organisms/ToolDetail.tsx` — `StarButton` next to title.
- `ui/pages/HomePage.tsx` — replaces the `ToolBrowser` branch with `<HomeAllTools …>`. Strip-visibility flag (`selection.kind === "all" && !query.trim()`) lives inside `HomeAllTools`, not in HomePage.

### 4.5 Visual language (token-driven)

- Section headers: same as `HistoryList`'s "Log" header — `font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink-3` with a hairline rule. Keeps Home and ToolDetail visually rhymed.
- `QuickTile`: `rounded-2 border border-line bg-surface px-3 py-2.5`, hover → `border-accent-edge bg-surface-2`, mount via `animate-tile-in`.
- Strip: `flex gap-2 overflow-x-auto` with right-edge mask fade on overflow.
- StatusDot uses tokens: `--color-success`, `--color-danger`, `--color-warning`. Verify presence in `@theme`; add if missing.
- StarButton: 24×24 hit target, 14px icon. Outline state opacity 0 by default, 100 on `group-hover` of card. Filled state always 100, color `text-accent`.

## 5. Data flow

**Pin/unpin:**
```
StarButton click
 → useFavorites.toggle(id)
 → settings.patch({ favorites: togglePin(prev, id, 8) })
 → SettingsContext re-emits → FavoritesBar re-renders
```

**Recent strip:**
```
useRecentTools(limit=6)
 → historyReader.listRecentTools(6)
 → invoke list_recent_tools_cmd
 → history::list_recent_tools scans audit.log
 → returns RecentToolRun[]; UI joins with state.tools, drops unknowns
runner.onExit fires → hook refreshes
```

## 6. Testing

- `src/domain/__tests__/favorites.test.ts` — `togglePin` cap/dedupe; `pruneMissing`; `isPinned`.
- `src/state/__tests__/useFavorites.test.ts` — fake `SettingsAdapter`, asserts toggle path and at-cap behavior.
- `src/application/__tests__/useRecentTools.test.ts` — fake `HistoryReader`, asserts refresh on simulated `onExit`.
- `src/ui/organisms/__tests__/FavoritesBar.test.tsx` — empty hint render, populated render, unpin click.
- `src/ui/organisms/__tests__/RecentRunsStrip.test.tsx` — hidden when empty, populated render, click → onPick.
- Rust `src-tauri/src/application/history.rs` — new tests:
  - `list_recent_tools_dedups_by_tool_id`
  - `list_recent_tools_orders_newest_first`
  - `list_recent_tools_respects_limit`
  - `list_recent_tools_includes_running_when_no_end`

## 7. Migration / compat

- `Settings.favorites` defaults to `[]` via `#[serde(default)]` and `DEFAULT_SETTINGS` — older settings files load without rewrite.
- No audit-log format changes; we read the existing JSONL.
- No `tools.json` schema changes.

## 8. Files (summary)

**New (10):**
- `src/domain/favorites.ts`
- `src/state/useFavorites.ts`
- `src/state/useRecentTools.ts`
- `src/ui/atoms/StarButton.tsx`
- `src/ui/atoms/StatusDot.tsx`
- `src/ui/molecules/QuickTile.tsx`
- `src/ui/organisms/FavoritesBar.tsx`
- `src/ui/organisms/RecentRunsStrip.tsx`
- `src/ui/organisms/HomeAllTools.tsx`
- Tests for each above

**Modified (~8):**
- `src/domain/settings.ts`, `src-tauri/src/domain/settings.rs`
- `src/application/ports.ts`
- `src/infrastructure/tauriHistoryReader.ts`
- `src-tauri/src/application/history.rs` (+ tests)
- `src-tauri/src/commands.rs`, `src-tauri/src/lib.rs` (handler registration)
- `src/ui/organisms/ToolCard.tsx`, `src/ui/organisms/ToolDetail.tsx`
- `src/ui/pages/HomePage.tsx`

## 9. Rollout

1. Backend: `list_recent_tools` use case + command + tests.
2. Domain: settings field + `favorites.ts` helpers + tests.
3. Application: ports update, `tauriHistoryReader` method, hooks.
4. Atoms + molecule.
5. Organisms: `FavoritesBar`, `RecentRunsStrip`, `HomeAllTools`.
6. Integrate into `ToolCard`, `ToolDetail`, `HomePage`.
7. Manual QA via `npm run tauri:dev`: pin/unpin from card and detail, cap behavior, empty/full strips, search/category visibility rule, run a tool → confirm Recent updates.
