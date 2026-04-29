# Library Loading Skeleton — Design

**Date:** 2026-04-29
**Status:** Approved (pending implementation plan)
**Scope:** Library section only (landing, all, detail)

## Problem

`useCatalog()` already exposes `status: "idle" | "loading" | "ready" | "error"` and an `error` string, but `LibraryRoute` ignores both — it destructures only `catalog` and passes `tools = catalog?.tools ?? []` to whichever page is selected.

Consequences while the catalog fetch is in flight:

- **Landing** renders an empty page (each `CatalogRow` returns `null` when its slice is empty).
- **All tools** renders "No tools match." — false negative.
- **Detail** renders "That tool isn't in the catalog anymore." — false 404.
- **Errors** are completely silent. A failed fetch looks identical to an empty catalog.

## Goals

- Show a skeleton matching each Library view's layout while `status` is `loading` or `idle`.
- Surface fetch errors with a retry affordance.
- Keep page components pure presentation; concentrate the new branching in the existing routing seam.
- No new abstractions beyond what the three views need.

## Non-goals

- No global `<Suspense>` boundary or generic loading provider.
- No skeleton variants prop / theming knobs.
- No shimmer animation config — one gentle pulse, end of story.
- No changes to other surfaces (Home, Settings, etc.).

## Architecture

The branching is a routing-layer concern. `LibraryRoute` already switches on `selection.view`; it's the only place that knows about catalog status. Pages stay pure — they take a fully populated `tools: CatalogTool[]` and render it.

Skeleton components are siblings of the real views, one per view, so the layout/spacing matches what loads in.

```
LibraryRoute
├── status === "loading" | "idle"  ──►  LibraryLandingSkeleton / LibraryAllSkeleton / LibraryToolDetailSkeleton
├── status === "error"             ──►  LibraryErrorState (with retry)
└── status === "ready"             ──►  existing LibraryLandingPage / LibraryAllPage / LibraryToolDetailPage
```

## Components

### New atom

**`src/ui/atoms/Skeleton.tsx`** — primitive shape:

- A `<div>` with `bg-bg-2`, `rounded-2`, `animate-pulse-soft`, accepting `className` for sizing.
- ~15 LOC. No props beyond `className` and `style`.

### Tailwind token

Add `--animate-pulse-soft` to the `@theme` block in `src/styles/tailwind.css` next to existing animations. Gentle opacity pulse, 1.4s, `ease-(--ease-smooth)`. Avoids depending on Tailwind's default `animate-pulse` so tokens stay in `@theme`.

### New molecules

- **`CatalogCardSkeleton.tsx`** — mirrors `CatalogCard` outer classes (border, padding, radius) without interactivity. Three internal `Skeleton`s for title, two body lines, one for the audience tag.
- **`LibraryErrorState.tsx`** — view-shaped error block. Takes `error: string`, `onRetry: () => void`. Title, message, "Try again" button. Used for all three views (one error look, no per-view variants).

### New organisms

Each is view-shaped and mirrors the real page layout one-for-one:

- **`LibraryLandingSkeleton.tsx`** — header skeleton + 4 rows of 3 horizontally-scrolling `CatalogCardSkeleton`s. Matches the four `CatalogRow`s in `LibraryLandingPage`.
- **`LibraryAllSkeleton.tsx`** — back button (real), header skeleton, search bar skeleton, chip row skeleton, 6-card grid of `CatalogCardSkeleton`s. Takes `onBack: () => void`.
- **`LibraryToolDetailSkeleton.tsx`** — back button (real), title skeleton, outcome lines, permission panel placeholder, action bar placeholder. Takes `onBack: () => void`.

Real back buttons (not skeletons) on All/Detail so navigation works while loading.

## Hook refactor

`src/application/useLibrary.ts`:

- Extract the fetch into a `useCallback` named `load`.
- Call `load()` from `useEffect`.
- Return `retry: load` alongside the existing `{ status, catalog, error }`.

~5-line change. Justified because `LibraryErrorState` needs a retry handler and the only thing that has it is the hook.

## Routing change

`src/ui/organisms/LibraryRoute.tsx`:

```tsx
const { status, catalog, error, retry } = useCatalog();

if (status === "idle" || status === "loading") {
  if (selection.view === "all")    return <LibraryAllSkeleton    onBack={openLanding} />;
  if (selection.view === "detail") return <LibraryToolDetailSkeleton onBack={openLanding} />;
  return <LibraryLandingSkeleton />;
}

if (status === "error") {
  return <LibraryErrorState error={error ?? "Failed to load library."} onRetry={retry} />;
}

// existing ready-state branches unchanged
```

## Files touched

**New (6):**
- `src/ui/atoms/Skeleton.tsx`
- `src/ui/molecules/CatalogCardSkeleton.tsx`
- `src/ui/molecules/LibraryErrorState.tsx`
- `src/ui/organisms/LibraryLandingSkeleton.tsx`
- `src/ui/organisms/LibraryAllSkeleton.tsx`
- `src/ui/organisms/LibraryToolDetailSkeleton.tsx`

**Edited (3):**
- `src/styles/tailwind.css` — add `--animate-pulse-soft`
- `src/application/useLibrary.ts` — extract `retry`
- `src/ui/organisms/LibraryRoute.tsx` — branch on `status`

## Testing

- **`src/ui/organisms/__tests__/LibraryRoute.test.tsx`** (new): with a fake `LibraryClient`, assert the route renders the skeleton during a pending fetch, the error state on rejection (and that retry triggers a refetch), and the real page on resolve. One file replaces six per-skeleton snapshot tests; the skeletons themselves are pure markup.
- Existing `LibraryLandingPage.test.tsx` / `LibraryAllPage.test.tsx` / `LibraryToolDetailPage.test.tsx`: unchanged. They receive `tools` directly and don't see status.

## Trade-offs

- **One skeleton per view vs. one generic skeleton**: chose per-view because layout fidelity matters (a generic block flashes the user with the wrong shape on transition). Cost is three small organism files; each is ~30 LOC of static markup.
- **Skeleton on detail when only the catalog is loading**: arguably overkill since detail rarely is the first view. Included because deep-linking and refresh both can land there, and the skeleton cost is small.
- **No animation knob / variants**: deliberately. Single `Skeleton` atom + one keyframe. If a second skeleton style is ever needed, generalize then — not now.

## Out of scope

- Loading states for `useAddTool` / `useRemoveTool` — already handled by the existing `busy` flag and detail page's button state.
- Skeleton for the sidebar Library entry — sidebar isn't catalog-data-driven.
- Telemetry / perceived-performance measurement.
