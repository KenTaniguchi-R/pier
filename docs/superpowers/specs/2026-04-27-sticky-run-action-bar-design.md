# Sticky Run Action Bar — Design Spec

**Date:** 2026-04-27
**Scope:** Tool detail screen (`ToolDetail` + `ToolRunner` + run controls)
**Status:** Approved for planning

## Problem

On the tool detail screen, the Run button sits on its own right-aligned row between the parameter form and the Output section. It wastes ~70px of vertical space, isn't reachable when the user has scrolled into long output, and mixes "form action" with the layout flow. Additionally, `ToolRunner` mixes three responsibilities — form rendering, run orchestration, and action UI — which makes it harder to evolve.

## Goals

1. Reclaim vertical space on the detail viewport.
2. Keep Run reachable regardless of scroll position.
3. Surface blocker reason as supporting text, not as the button label.
4. Untangle form rendering from run orchestration without overbuilding.

## Non-goals

- No global keybinding registry, command palette, or run-history dropdown.
- No state library — keep `useState` + context.
- No changes to backend, sidebar, log panel, or detail header collapse behavior.
- No public API change to `RunControl` (preserve existing tests).

## Architecture

### Layer responsibilities (after refactor)

| Layer | File | Owns |
|---|---|---|
| Application | `application/useToolRun.ts` *(new)* | values, blocker/canRun, isRunning, confirmOpen, startRun, stopRun, resolvedArgs, ⌘↵ / ⌘. shortcuts |
| UI / Organism | `ui/organisms/ToolDetail.tsx` | Layout, calls `useToolRun`, composes header + form + bar + log + confirm dialog |
| UI / Organism | `ui/organisms/ToolRunner.tsx` | **Dumb form only.** Renders required fields + advanced disclosure. Props: `params`, `values`, `onChange`. No app/runner hooks. |
| UI / Molecule | `ui/molecules/RunActionBar.tsx` *(new)* | Sticky bar chrome, status hint slot, wraps `RunControl` |
| UI / Molecule | `ui/molecules/RunControl.tsx` | Run/Stop button (unchanged) |

### Data flow

```
ToolDetail
  ├─ const run = useToolRun(tool)        ← application hook
  ├─ <ToolDetailHeader … />
  ├─ <scroll>
  │    ├─ <ToolRunner params values onChange={run.setValue} />
  │    ├─ Output divider
  │    └─ <LogPanel … />
  ├─ <RunActionBar
  │     running={run.isRunning}
  │     canRun={run.canRun}
  │     blockedReason={run.blockedReason}
  │     onRun={run.onRunClick}
  │     onStop={run.stopRun} />
  └─ <ConfirmDialog … bound to run.confirm* />
```

## Visual spec — `RunActionBar`

- Position: `sticky bottom-0` inside the detail flex column (sibling of scroll area, **outside** it).
- Height: ~52px. Padding: `px-10 py-2.5` (matches header gutter).
- Background: `bg-bg/85 backdrop-blur-sm`, `border-t border-line`, upward `shadow-1`.
- Layout: `flex items-center justify-between`.
  - Left slot:
    - Idle + ready: faint `⌘↵ to run` hint in `text-ink-3`.
    - Idle + blocked: `blockedReason` text in `text-ink-3`.
    - Running: live elapsed timer + spinner dot (reuse `molecules/elapsed.ts`).
  - Right slot: `<RunControl … />` (unchanged).

## Keyboard shortcuts

Attached in `useToolRun` via a `useEffect` that listens on `window`:

- `⌘↵` (Cmd+Enter) → `onRunClick()` when `canRun && !isRunning`.
- `⌘.` (Cmd+Period) → `stopRun()` when `isRunning`.

Listener is scoped to the lifetime of the detail screen via `useToolRun`'s effect cleanup. No registry, no global state.

## Test strategy

- `RunControl.test.tsx` — unchanged. Confirms public API stability.
- `ToolRunner.test.tsx` — rewrite as dumb-form tests: given params + values, renders fields and emits `onChange`. No run/blocker assertions here.
- `RunActionBar.test.tsx` *(new)* — renders bar in idle-ready / blocked / running states; clicks delegate to props.
- `useToolRun.test.ts` *(new)* — orchestration: blocker computation, startRun calls runner port, stopRun calls kill, ⌘↵ triggers run when canRun.

## Build sequence

1. Extract `useToolRun` from `ToolRunner` (no behavior change — bar still in old place). All existing tests pass.
2. Add `RunActionBar` molecule + its test. Not yet wired.
3. Refactor `ToolDetail` to call `useToolRun`, render `RunActionBar` and `ConfirmDialog` as siblings of the scroll area; pass form props down to `ToolRunner`.
4. Slim `ToolRunner` to dumb form. Update its test.
5. Add `⌘↵` / `⌘.` shortcuts in `useToolRun`.
6. Visual polish via `npm run tauri:dev`; verify scroll behavior, bar shadow, and backdrop on light theme.

Estimated diff: ~+180 / −90 lines across 6 files.

## Risks

- **Sticky + flex pitfalls:** the bar must be a sibling of the scroll container, not inside it, or `sticky bottom-0` will misbehave. Mitigation: explicit layout test in step 3.
- **Backdrop blur cost:** acceptable for a ~52px bar; if perf regresses, drop to solid `bg-bg`.
- **Keyboard conflicts:** `⌘↵` is sometimes used by inputs (textarea newline). Mitigation: only fire when target is not a textarea, or when `event.metaKey` and not composing.
