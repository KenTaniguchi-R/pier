# Library as a sidebar section

**Date:** 2026-04-28
**Status:** Approved (design)
**Branch:** feat/library

## Problem

The tool Library is currently surfaced through a `+` "AddTile" appended to the tool grid, which opens a full-screen modal sheet (`LibrarySheet`) hosting the `LibraryBrowser`. This makes Library feel like a transient action rather than a first-class destination, and it requires a parallel state machine (`librarySheetOpen` + `LIBRARY_SHEET_OPEN/CLOSE` actions) that exists only to drive the modal.

## Goal

Promote Library to a first-class sidebar destination — same UX model as Settings and Setup with Claude. Clicking it routes the main pane to the `LibraryBrowser`. No modal. The parallel state machine collapses into the existing `Selection` union.

## Design

### Sidebar bottom group

The existing bottom block in `Sidebar.tsx` already groups `Setup with Claude` and `Settings`. Library joins this block, separated by a hairline divider. **No section label** — consistent with the rest of the bottom group.

```
... (categories scroll area above) ...
─────────────────  (existing border-t)
  ◇ Library
─────────────────  (new hairline divider, mx-2)
  ⊙ Setup with Claude
  ⚙ Settings
─────────────────  (footer ~/.pier/tools.json)
```

- Library uses the existing `SidebarItem` molecule (icon + label + active state) — identical treatment to Help/Settings. Active state is the same accent-soft fill the other items already use.
- Icon: `Library` from `lucide-react` (size 14, strokeWidth 2 — matching the other bottom items).
- Divider: `<li className="h-px bg-line mx-2 my-1" aria-hidden />` — same hairline pattern used between the All-tools group and Categories.

### Selection routing

`Selection` in `Sidebar.tsx` extends from:
```ts
| { kind: "all" } | { kind: "category"; name: string } | { kind: "tool"; id: string }
| { kind: "help" } | { kind: "settings" }
```
to add:
```ts
| { kind: "library" }
```

`HomePage.tsx`'s render switch gains:
```tsx
else if (selection.kind === "library") {
  main = <LibraryBrowser />;
}
```

### Removed: modal sheet machinery

Library no longer lives outside the navigation, so the supporting machinery is deleted:

- **`src/ui/templates/LibrarySheet.tsx`** — deleted.
- **`src/ui/organisms/AddTile.tsx`** — deleted.
- **`<LibrarySheet />` mount in `App.tsx`** — removed.
- **`<AddTile />` use in `ToolBrowser.tsx`** — removed (and its import).
- **`librarySheetOpen` field on `AppState`** — removed.
- **`LIBRARY_SHEET_OPEN` / `LIBRARY_SHEET_CLOSE` action types** — removed from `state/actions.ts` and reducer cases.

### LibraryBrowser

`LibraryBrowser.tsx` already renders a page-shaped layout (`flex flex-col gap-5 px-8 py-6`, mono uppercase eyebrow, display-font H1, search row, grid). It's used inside the sheet today; it works as a top-level page with no changes beyond confirming padding parity with `SettingsPage` (`p-6 px-8` is the canonical page wrapper — `LibraryBrowser`'s `px-8 py-6` is equivalent).

The internal `AddToolDialog` flow (preview → confirm) is unchanged — it's a child dialog spawned from a card click, not the page chrome.

### Architecture notes

- Boundary layering preserved: this is purely a UI/state-shape change. `application/useLibrary.ts`, `infrastructure/tauriLibraryClient.ts`, and `domain/library.ts` are untouched.
- Atomic design preserved: `LibraryBrowser` remains an organism; `AppShell` template is untouched; the sidebar still composes from existing molecules (`SidebarItem`).
- Net change: **−1 template, −1 organism, −1 reducer slice, −2 action types**, +1 sidebar entry, +1 main-pane route. Refactor reduces surface area while serving the task.

## Tests

- Delete `AddTile`'s test if one exists (no standalone test file currently — only referenced from `ToolBrowser.test.tsx` if any).
- Any test that asserts on `librarySheetOpen` or dispatches the removed actions: update or remove.
- `LibraryBrowser.test.tsx` and `LibraryToolCard.test.tsx` continue to pass — they test the organism/molecule directly, not the chrome.
- Sanity: `npm run test:run`, `npm run build`, `cargo test --manifest-path src-tauri/Cargo.toml` (Rust untouched, but confirms cross-cutting nothing leaked).

## Out of scope

- Library content/pagination/categorization — handled by existing `LibraryBrowser`.
- Catalog data model, signing, install pipeline — already shipped.
- Sidebar section label / grouping headers — explicitly chose option (c): no label.
