# Library as Sidebar Section — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Promote the Library from a modal sheet (opened via a `+` AddTile in the tool grid) to a first-class sidebar destination, same routing model as Settings.

**Architecture:** Extend the existing `Selection` discriminated union in `Sidebar.tsx` with `{ kind: "library" }`. Route to `<LibraryBrowser />` in `HomePage.tsx`'s render switch. Remove the parallel state machine (`librarySheetOpen` + `LIBRARY_SHEET_OPEN/CLOSE` actions), the `LibrarySheet` template, the `AddTile` organism, and their mounts.

**Tech Stack:** React 19, TypeScript, Tailwind v4 (CSS-first), Tauri 2, Vitest + jsdom, lucide-react.

**Spec:** `docs/superpowers/specs/2026-04-28-library-as-sidebar-section-design.md`

---

## File Structure

**Modify:**
- `src/ui/organisms/Sidebar.tsx` — extend `Selection`, add Library `SidebarItem` + divider in bottom group.
- `src/ui/pages/HomePage.tsx` — route `selection.kind === "library"` to `<LibraryBrowser />`.
- `src/ui/organisms/ToolBrowser.tsx` — remove `<AddTile />` and its import.
- `src/state/actions.ts` — drop `LIBRARY_SHEET_OPEN/CLOSE` action types.
- `src/state/reducer.ts` — drop `librarySheetOpen` field + reducer cases.
- `src/App.tsx` — drop `<LibrarySheet />` mount + import.

**Delete:**
- `src/ui/templates/LibrarySheet.tsx`
- `src/ui/organisms/AddTile.tsx`

**No backend changes.** Rust side is untouched.

---

## Task 1: Remove modal sheet machinery (state + mounts)

Done first because it lets us delete files cleanly without leaving orphan references when the next task switches the routing.

**Files:**
- Modify: `src/state/actions.ts`
- Modify: `src/state/reducer.ts`
- Modify: `src/App.tsx`
- Modify: `src/ui/organisms/ToolBrowser.tsx`
- Delete: `src/ui/templates/LibrarySheet.tsx`
- Delete: `src/ui/organisms/AddTile.tsx`

- [ ] **Step 1: Drop the action types**

In `src/state/actions.ts`, replace the file contents with:

```ts
import type { Tool, Defaults } from "../domain/tool";
import type { RunStatus, Stream } from "../domain/runRequest";

export type Action =
  | { type: "CONFIG_LOADED"; tools: Tool[]; defaults?: Defaults }
  | { type: "CONFIG_ERROR"; errors: string[] }
  | { type: "RUN_STARTED"; runId: string; toolId: string; startedAt: number }
  | { type: "RUN_OUTPUT"; runId: string; line: string; stream: Stream; transient: boolean }
  | { type: "RUN_EXIT"; runId: string; status: RunStatus; exitCode: number | null; endedAt: number };
```

- [ ] **Step 2: Drop `librarySheetOpen` from the reducer**

In `src/state/reducer.ts`:

Remove `librarySheetOpen: boolean;` from the `AppState` interface (around line 29).

Remove `librarySheetOpen: false,` from `initialState` (around line 38).

Remove the two reducer cases (around lines 79–82):

```ts
case "LIBRARY_SHEET_OPEN":
  return { ...s, librarySheetOpen: true };
case "LIBRARY_SHEET_CLOSE":
  return { ...s, librarySheetOpen: false };
```

- [ ] **Step 3: Remove `<LibrarySheet />` mount from `App.tsx`**

In `src/App.tsx`:

Delete the import line:
```ts
import { LibrarySheet } from "./ui/templates/LibrarySheet";
```

Delete the JSX line `<LibrarySheet />` from inside `<UpdaterControllerHost>`.

- [ ] **Step 4: Remove `<AddTile />` from `ToolBrowser.tsx`**

In `src/ui/organisms/ToolBrowser.tsx`:

Delete the import:
```ts
import { AddTile } from "./AddTile";
```

Delete the `<AddTile />` line at the bottom of the grid in the JSX.

- [ ] **Step 5: Delete the now-unreferenced files**

```bash
rm src/ui/templates/LibrarySheet.tsx
rm src/ui/organisms/AddTile.tsx
```

- [ ] **Step 6: Verify no dangling references**

Run:
```bash
grep -rn "librarySheetOpen\|LIBRARY_SHEET\|AddTile\|LibrarySheet" src/ src-tauri/src 2>/dev/null
```
Expected: no output.

- [ ] **Step 7: Typecheck + tests still pass (modulo the routing gap that Task 2 fills)**

Run:
```bash
npm run build
```
Expected: PASS. (At this point Library is unreachable from the UI — that's intentional; Task 2 wires it back in via the sidebar.)

```bash
npm run test:run
```
Expected: PASS. The reducer test (`src/state/__tests__/reducer.test.ts`) doesn't reference the removed actions, and no test imports `AddTile` or `LibrarySheet`.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
refactor(library): remove modal sheet + AddTile scaffolding

Drops librarySheetOpen state, LIBRARY_SHEET_* actions, the LibrarySheet
template, the AddTile organism, and its mount in ToolBrowser. Library is
unreachable from the UI between this commit and the next; the next commit
wires it in as a sidebar destination.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Add Library as a sidebar destination

**Files:**
- Modify: `src/ui/organisms/Sidebar.tsx`
- Modify: `src/ui/pages/HomePage.tsx`

- [ ] **Step 1: Extend the `Selection` union**

In `src/ui/organisms/Sidebar.tsx`, update the `Selection` type (around line 10):

```ts
export type Selection =
  | { kind: "all" }
  | { kind: "category"; name: string }
  | { kind: "tool"; id: string }
  | { kind: "help" }
  | { kind: "library" }
  | { kind: "settings" };
```

- [ ] **Step 2: Import the Library icon**

In `src/ui/organisms/Sidebar.tsx`, change the lucide-react import (line 2) to:

```ts
import { Home, HelpCircle, Library as LibraryIcon, Settings as SettingsIcon } from "lucide-react";
```

- [ ] **Step 3: Add an `isLibrary` flag**

In `src/ui/organisms/Sidebar.tsx`, after the existing flags (around line 120):

```ts
const isLibrary = selection.kind === "library";
```

- [ ] **Step 4: Render the Library item + divider in the bottom group**

In `src/ui/organisms/Sidebar.tsx`, replace the bottom-group `<div>` (currently around lines 203–216 — the `flex-none px-2 pt-2 pb-1 border-t border-line` block) with:

```tsx
<div className="flex-none px-2 pt-2 pb-1 border-t border-line flex flex-col gap-[2px]">
  <SidebarItem
    icon={<LibraryIcon size={14} strokeWidth={2} />}
    label="Library"
    active={isLibrary}
    onClick={() => onSelect({ kind: "library" })}
  />
  <div className="h-px bg-line mx-2 my-1" aria-hidden />
  <SidebarItem
    icon={<HelpCircle size={14} strokeWidth={2} />}
    label="Setup with Claude"
    active={isHelp}
    onClick={() => onSelect({ kind: "help" })}
  />
  <SidebarItem
    icon={<SettingsIcon size={14} strokeWidth={2} />}
    label="Settings"
    active={isSettings}
    onClick={() => onSelect({ kind: "settings" })}
  />
</div>
```

- [ ] **Step 5: Route `selection.kind === "library"` to `<LibraryBrowser />`**

In `src/ui/pages/HomePage.tsx`:

Add the import near the other organism imports (alongside `HomeAllTools`, `ToolDetail`, `SkillGuide`):

```ts
import { LibraryBrowser } from "../organisms/LibraryBrowser";
```

In the render switch (currently around lines 86–127), add a new branch between the `help` and `settings` cases:

```tsx
} else if (selection.kind === "help") {
  main = <SkillGuide />;
} else if (selection.kind === "library") {
  main = <LibraryBrowser />;
} else if (selection.kind === "settings") {
  main = <SettingsPage />;
```

- [ ] **Step 6: Typecheck**

Run:
```bash
npm run build
```
Expected: PASS — no TS errors. The `Selection` union is exhaustive in every consumer (the bottom of `HomePage.tsx`'s switch already falls through to the default tool-grid render).

- [ ] **Step 7: Run tests**

Run:
```bash
npm run test:run
```
Expected: PASS. `LibraryBrowser.test.tsx` and `LibraryToolCard.test.tsx` still test the organism/molecule directly. The reducer test is unaffected.

- [ ] **Step 8: Manual smoke test**

Run:
```bash
npm run tauri:dev
```

Verify all of the following:
1. Sidebar shows `Library` above a hairline divider, with `Setup with Claude` and `Settings` below.
2. Clicking `Library` activates the item (accent left-edge bar) and renders the catalog page in the main area, identical to what the modal sheet used to show.
3. Clicking `Settings` switches main pane to Settings; clicking `Library` switches back. No flicker, no leftover modal overlay.
4. The tool grid no longer shows a `+` AddTile.
5. ESC does nothing surprising (there's no modal to close anymore).
6. Picking a catalog tool still opens the `AddToolDialog` preview correctly and committing adds the tool.

If any check fails, fix and re-test before committing.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat(library): promote Library to a sidebar destination

Library is now a first-class navigation target in the sidebar bottom
group, alongside Setup with Claude and Settings. Selecting it routes
the main pane to LibraryBrowser, mirroring the Settings UX. Replaces
the modal-sheet + AddTile entry point.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Final verification

**Files:** none modified — verification only.

- [ ] **Step 1: Full frontend test + typecheck + build**

```bash
npm run test:run && npm run build
```
Expected: PASS.

- [ ] **Step 2: Rust still compiles + tests pass (sanity — no Rust files were touched)**

```bash
cargo test --manifest-path src-tauri/Cargo.toml
```
Expected: PASS.

- [ ] **Step 3: Lint (Rust) sanity**

```bash
cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings
```
Expected: PASS (or whatever the project's existing baseline is — do not introduce new warnings).

- [ ] **Step 4: Confirm no dead references**

```bash
grep -rn "librarySheetOpen\|LIBRARY_SHEET\|AddTile\|LibrarySheet" src/ src-tauri/src docs/ 2>/dev/null
```
Expected: only matches in `docs/superpowers/specs/2026-04-28-library-as-sidebar-section-design.md` and `docs/superpowers/plans/2026-04-28-library-as-sidebar-section.md` (the design + plan). No code matches.

---

## Self-review notes

- **Spec coverage:** Sidebar bottom-group placement (Task 2 Step 4); no section label — matches design choice (c). Selection union extension (Task 2 Step 1). Routing to `LibraryBrowser` (Task 2 Step 5). Removal of `LibrarySheet`, `AddTile`, `librarySheetOpen`, `LIBRARY_SHEET_*` actions, and their mounts (Task 1). LibraryBrowser left untouched per spec (already page-shaped). Tests sanity-checked (Task 3).
- **Placeholder scan:** every step contains the exact code or command. No "TBD" / "similar to" / hand-waves.
- **Type consistency:** `Selection` extension uses `{ kind: "library" }` consistently across Sidebar (Step 1) and HomePage (Step 5). Lucide import aliased to `LibraryIcon` to avoid collision with the React component name `Library` (we don't have one, but `LibraryBrowser` is close enough that aliasing keeps the file scannable).
- **Ordering rationale:** Task 1 deletes the old path before Task 2 builds the new one. Between commits, Library is briefly unreachable from the UI — flagged in the Task 1 commit message. This avoids a moment where both paths coexist (which would invite double-entry-point bugs).
