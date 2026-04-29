# Library Loading Skeleton Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a per-view skeleton (landing / all / detail) while the library catalog is fetching, and a retryable error state on fetch failure.

**Architecture:** `LibraryRoute` is the existing routing seam — it now branches on `useCatalog()`'s `status` to render skeleton organisms during load, an error molecule on failure, or the existing pages when ready. Pages remain pure presentation. One new `Skeleton` atom + one `--animate-pulse-soft` token power three view-shaped skeleton organisms.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4 (CSS-first `@theme`), Vitest + Testing Library, Tauri.

**Spec:** `docs/superpowers/specs/2026-04-29-library-loading-skeleton-design.md`

---

## File map

**New files (6):**
- `src/ui/atoms/Skeleton.tsx` — primitive shape, ~15 LOC
- `src/ui/atoms/__tests__/Skeleton.test.tsx` — render test
- `src/ui/molecules/CatalogCardSkeleton.tsx` — card-shaped placeholder
- `src/ui/molecules/LibraryErrorState.tsx` — error block + retry
- `src/ui/molecules/__tests__/LibraryErrorState.test.tsx`
- `src/ui/organisms/LibraryLandingSkeleton.tsx`
- `src/ui/organisms/LibraryAllSkeleton.tsx`
- `src/ui/organisms/LibraryToolDetailSkeleton.tsx`
- `src/ui/organisms/__tests__/LibraryRoute.test.tsx` — integration: status → render

**Edited (3):**
- `src/styles/tailwind.css` — add `--animate-pulse-soft` + keyframe
- `src/application/useLibrary.ts` — extract `retry` callback
- `src/ui/organisms/LibraryRoute.tsx` — branch on `status`

(Note: the count above is 7 new components + 3 new test files = 10 new files. The "6" in the spec was components only.)

---

## Task 1: Add the pulse animation token

**Files:**
- Modify: `src/styles/tailwind.css`

- [ ] **Step 1: Add the animate token + keyframe inside `@theme`**

In `src/styles/tailwind.css`, inside the `@theme { ... }` block, alongside the other `--animate-*` tokens (around line 65 after `--animate-toast-in`), add:

```css
  --animate-pulse-soft: pulse-soft 1.4s var(--ease-smooth) infinite;
```

Then alongside the other `@keyframes` blocks (e.g. after `@keyframes toast-in` near line 108, still inside `@theme`), add:

```css
  @keyframes pulse-soft {
    0%, 100% { opacity: 0.55; }
    50%      { opacity: 0.95; }
  }
```

- [ ] **Step 2: Verify the dev build still type-checks**

Run: `npm run build`
Expected: succeeds; `dist/` is regenerated with no Tailwind warnings about unknown utilities.

- [ ] **Step 3: Commit**

```bash
git add src/styles/tailwind.css
git commit -m "feat(library): add pulse-soft animation token for skeletons"
```

---

## Task 2: Skeleton atom

**Files:**
- Create: `src/ui/atoms/Skeleton.tsx`
- Test: `src/ui/atoms/__tests__/Skeleton.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/ui/atoms/__tests__/Skeleton.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Skeleton } from "../Skeleton";

describe("Skeleton", () => {
  it("renders a div with pulse animation and merges className", () => {
    const { container } = render(<Skeleton className="h-4 w-20" data-testid="s" />);
    const el = container.querySelector('[data-testid="s"]') as HTMLElement;
    expect(el).toBeInTheDocument();
    expect(el.className).toContain("animate-pulse-soft");
    expect(el.className).toContain("bg-bg-2");
    expect(el.className).toContain("rounded-2");
    expect(el.className).toContain("h-4");
    expect(el.className).toContain("w-20");
  });

  it("is aria-hidden so screen readers skip the placeholder", () => {
    const { container } = render(<Skeleton />);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/ui/atoms/__tests__/Skeleton.test.tsx`
Expected: FAIL — `Cannot find module '../Skeleton'`.

- [ ] **Step 3: Implement the atom**

Create `src/ui/atoms/Skeleton.tsx`:

```tsx
import type { HTMLAttributes } from "react";

const BASE = "block bg-bg-2 rounded-2 animate-pulse-soft";

/** Static placeholder shape used by skeleton screens. Size with `className`. */
export function Skeleton({
  className = "",
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden="true" className={`${BASE} ${className}`} {...rest} />;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/ui/atoms/__tests__/Skeleton.test.tsx`
Expected: PASS, 2/2.

- [ ] **Step 5: Commit**

```bash
git add src/ui/atoms/Skeleton.tsx src/ui/atoms/__tests__/Skeleton.test.tsx
git commit -m "feat(library): add Skeleton atom"
```

---

## Task 3: CatalogCardSkeleton molecule

**Files:**
- Create: `src/ui/molecules/CatalogCardSkeleton.tsx`

No test file — pure markup composed of already-tested `Skeleton` atoms. The integration test in Task 8 covers it.

- [ ] **Step 1: Implement the molecule**

Create `src/ui/molecules/CatalogCardSkeleton.tsx`:

```tsx
import type { CSSProperties } from "react";
import { Skeleton } from "../atoms/Skeleton";

interface Props {
  style?: CSSProperties;
}

/** Visual placeholder for `CatalogCard` — same outer shape, no interactivity. */
export function CatalogCardSkeleton({ style }: Props) {
  return (
    <div
      aria-hidden="true"
      style={style}
      className="bg-surface border border-line rounded-2 px-4 py-3.5 flex flex-col gap-2"
    >
      <Skeleton className="h-[18px] w-3/5 rounded-1" />
      <Skeleton className="h-[13px] w-full rounded-1" />
      <Skeleton className="h-[13px] w-4/5 rounded-1" />
      <Skeleton className="mt-1 h-[11px] w-16 rounded-1" />
    </div>
  );
}
```

- [ ] **Step 2: Smoke check the import compiles**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/ui/molecules/CatalogCardSkeleton.tsx
git commit -m "feat(library): add CatalogCardSkeleton molecule"
```

---

## Task 4: LibraryErrorState molecule

**Files:**
- Create: `src/ui/molecules/LibraryErrorState.tsx`
- Test: `src/ui/molecules/__tests__/LibraryErrorState.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/ui/molecules/__tests__/LibraryErrorState.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LibraryErrorState } from "../LibraryErrorState";

describe("LibraryErrorState", () => {
  it("renders the error message inside an alert region", () => {
    render(<LibraryErrorState error="Network down" onRetry={() => {}} />);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Network down");
  });

  it("calls onRetry when Try again is clicked", async () => {
    const onRetry = vi.fn();
    render(<LibraryErrorState error="oops" onRetry={onRetry} />);
    await userEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/ui/molecules/__tests__/LibraryErrorState.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the molecule**

Create `src/ui/molecules/LibraryErrorState.tsx`:

```tsx
import { Button } from "../atoms/Button";

interface Props {
  error: string;
  onRetry: () => void;
}

/** View-shaped error block shown when the library catalog fetch fails. */
export function LibraryErrorState({ error, onRetry }: Props) {
  return (
    <div className="flex flex-col gap-5 px-8 py-6">
      <header>
        <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-danger mb-1.5">
          Library · Unavailable
        </div>
        <h1 className="font-display text-2xl text-ink">Couldn't load the catalog</h1>
        <p className="mt-1.5 text-[14px] text-ink-3">
          The signed catalog couldn't be fetched. Check your connection and try again.
        </p>
      </header>

      <aside
        role="alert"
        className="border-l-2 border-danger bg-danger-soft/60 pl-4 pr-3 py-3 rounded-r-2"
      >
        <pre className="font-mono text-[12px] leading-relaxed text-ink-2 whitespace-pre-wrap break-words">
          {error}
        </pre>
      </aside>

      <div>
        <Button variant="primary" onClick={onRetry}>
          Try again
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/ui/molecules/__tests__/LibraryErrorState.test.tsx`
Expected: PASS, 2/2.

- [ ] **Step 5: Commit**

```bash
git add src/ui/molecules/LibraryErrorState.tsx src/ui/molecules/__tests__/LibraryErrorState.test.tsx
git commit -m "feat(library): add LibraryErrorState molecule"
```

---

## Task 5: LibraryLandingSkeleton organism

**Files:**
- Create: `src/ui/organisms/LibraryLandingSkeleton.tsx`

- [ ] **Step 1: Implement the organism**

Create `src/ui/organisms/LibraryLandingSkeleton.tsx`:

```tsx
import { Skeleton } from "../atoms/Skeleton";
import { CatalogCardSkeleton } from "../molecules/CatalogCardSkeleton";

const ROW_TITLES = ["Featured", "New this week", "For developers", "Popular"];
const CARDS_PER_ROW = 3;

/** Loading state for `LibraryLandingPage`. Mirrors its 4-row layout. */
export function LibraryLandingSkeleton() {
  return (
    <div className="flex flex-col gap-8 px-8 py-6" aria-busy="true" aria-live="polite">
      <header>
        <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink-3 mb-1.5">
          Library
        </div>
        <h1 className="font-display text-3xl leading-tight text-ink">Browse tools</h1>
        <p className="mt-1.5 text-[14px] text-ink-3">
          Curated, signed tools from the <span className="font-mono">pier-tools</span> catalog.
        </p>
      </header>

      {ROW_TITLES.map((title) => (
        <section key={title} className="flex flex-col gap-3">
          <header className="flex items-baseline justify-between">
            <h2 className="font-display text-xl text-ink">{title}</h2>
          </header>
          <div className="flex gap-3 overflow-hidden pb-1 -mx-1 px-1">
            {Array.from({ length: CARDS_PER_ROW }).map((_, i) => (
              <div key={i} className="shrink-0 w-[280px]">
                <CatalogCardSkeleton />
              </div>
            ))}
          </div>
        </section>
      ))}

      <span className="sr-only">Loading library…</span>
      {/* Skeleton import keeps the dependency explicit even if not used directly here yet. */}
      <Skeleton className="hidden" />
    </div>
  );
}
```

Note: the trailing hidden `Skeleton` is removed — replace the last two lines (`<Skeleton className="hidden" />` block and its comment) with nothing. Final file ends after `</div>`. Updated body:

```tsx
import { CatalogCardSkeleton } from "../molecules/CatalogCardSkeleton";

const ROW_TITLES = ["Featured", "New this week", "For developers", "Popular"];
const CARDS_PER_ROW = 3;

/** Loading state for `LibraryLandingPage`. Mirrors its 4-row layout. */
export function LibraryLandingSkeleton() {
  return (
    <div className="flex flex-col gap-8 px-8 py-6" aria-busy="true" aria-live="polite">
      <header>
        <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink-3 mb-1.5">
          Library
        </div>
        <h1 className="font-display text-3xl leading-tight text-ink">Browse tools</h1>
        <p className="mt-1.5 text-[14px] text-ink-3">
          Curated, signed tools from the <span className="font-mono">pier-tools</span> catalog.
        </p>
      </header>

      {ROW_TITLES.map((title) => (
        <section key={title} className="flex flex-col gap-3">
          <header className="flex items-baseline justify-between">
            <h2 className="font-display text-xl text-ink">{title}</h2>
          </header>
          <div className="flex gap-3 overflow-hidden pb-1 -mx-1 px-1">
            {Array.from({ length: CARDS_PER_ROW }).map((_, i) => (
              <div key={i} className="shrink-0 w-[280px]">
                <CatalogCardSkeleton />
              </div>
            ))}
          </div>
        </section>
      ))}

      <span className="sr-only">Loading library…</span>
    </div>
  );
}
```

Use the second version. The first was a draft.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/ui/organisms/LibraryLandingSkeleton.tsx
git commit -m "feat(library): add LibraryLandingSkeleton"
```

---

## Task 6: LibraryAllSkeleton organism

**Files:**
- Create: `src/ui/organisms/LibraryAllSkeleton.tsx`

- [ ] **Step 1: Implement the organism**

Create `src/ui/organisms/LibraryAllSkeleton.tsx`:

```tsx
import { Skeleton } from "../atoms/Skeleton";
import { CatalogCardSkeleton } from "../molecules/CatalogCardSkeleton";

interface Props {
  onBack: () => void;
}

const CARDS = 6;
const CHIP_WIDTHS = ["w-12", "w-16", "w-20", "w-14"];

/** Loading state for `LibraryAllPage`. Real back button so navigation still works. */
export function LibraryAllSkeleton({ onBack }: Props) {
  return (
    <div className="flex flex-col gap-5 px-8 py-6" aria-busy="true" aria-live="polite">
      <header className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="text-[13px] text-ink-3 hover:text-ink"
        >
          ← Back
        </button>
        <h1 className="font-display text-2xl text-ink">All tools</h1>
      </header>

      <Skeleton className="h-9 w-full rounded-2" />

      <div className="flex flex-wrap gap-2">
        {CHIP_WIDTHS.map((w, i) => (
          <Skeleton key={i} className={`h-7 ${w} rounded-pill`} />
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: CARDS }).map((_, i) => (
          <CatalogCardSkeleton key={i} />
        ))}
      </div>

      <span className="sr-only">Loading library…</span>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/ui/organisms/LibraryAllSkeleton.tsx
git commit -m "feat(library): add LibraryAllSkeleton"
```

---

## Task 7: LibraryToolDetailSkeleton organism

**Files:**
- Create: `src/ui/organisms/LibraryToolDetailSkeleton.tsx`

- [ ] **Step 1: Implement the organism**

Create `src/ui/organisms/LibraryToolDetailSkeleton.tsx`:

```tsx
import { Skeleton } from "../atoms/Skeleton";

interface Props {
  onBack: () => void;
}

/** Loading state for `LibraryToolDetailPage`. */
export function LibraryToolDetailSkeleton({ onBack }: Props) {
  return (
    <div className="flex flex-col gap-6 px-8 py-6" aria-busy="true" aria-live="polite">
      <button
        type="button"
        onClick={onBack}
        aria-label="Back to Library"
        className="self-start text-[13px] text-ink-3 hover:text-ink"
      >
        ← Back to Library
      </button>

      <header className="flex items-start justify-between gap-6">
        <div className="flex flex-col gap-2 min-w-0 flex-1">
          <Skeleton className="h-3 w-24 rounded-1" />
          <Skeleton className="h-9 w-2/3 rounded-1" />
          <Skeleton className="h-4 w-3/4 rounded-1" />
          <Skeleton className="h-4 w-2/5 rounded-1" />
        </div>
        <div className="shrink-0">
          <Skeleton className="h-10 w-36 rounded-2" />
        </div>
      </header>

      {/* Permission panel placeholder */}
      <div className="border border-line rounded-2 p-4 flex flex-col gap-2">
        <Skeleton className="h-4 w-32 rounded-1" />
        <Skeleton className="h-3 w-full rounded-1" />
        <Skeleton className="h-3 w-5/6 rounded-1" />
      </div>

      <section className="flex flex-col gap-3">
        <Skeleton className="h-6 w-40 rounded-1" />
        <Skeleton className="h-3 w-full rounded-1" />
        <Skeleton className="h-3 w-11/12 rounded-1" />
        <Skeleton className="h-3 w-9/12 rounded-1" />
      </section>

      <span className="sr-only">Loading tool details…</span>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/ui/organisms/LibraryToolDetailSkeleton.tsx
git commit -m "feat(library): add LibraryToolDetailSkeleton"
```

---

## Task 8: Add `retry` to `useCatalog`

**Files:**
- Modify: `src/application/useLibrary.ts`

- [ ] **Step 1: Read the current hook**

The current `useCatalog` (lines 7–29) does the fetch inline inside `useEffect`. Replace it with a version that extracts the fetch into a `useCallback` so it can be returned as `retry`.

- [ ] **Step 2: Replace the function**

In `src/application/useLibrary.ts`, replace the `useCatalog` function body so the file's first export reads:

```ts
import { useCallback, useEffect, useState } from "react";
import { useLibraryClient } from "../state/LibraryContext";
import type { Catalog } from "../domain/library";

type Status = "idle" | "loading" | "ready" | "error";

export function useCatalog() {
  const client = useLibraryClient();
  const [status, setStatus] = useState<Status>("idle");
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setStatus("loading");
    setError(null);
    client
      .fetchCatalog()
      .then((c) => {
        setCatalog(c);
        setStatus("ready");
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : String(e));
        setStatus("error");
      });
  }, [client]);

  useEffect(() => {
    load();
  }, [load]);

  return { status, catalog, error, retry: load };
}
```

The other exports (`useAddTool`, `useRemoveTool`) stay untouched.

- [ ] **Step 3: Run library-related tests**

Run: `npx vitest run src/ui/pages/__tests__/LibraryLandingPage.test.tsx src/ui/pages/__tests__/LibraryAllPage.test.tsx src/ui/pages/__tests__/LibraryToolDetailPage.test.tsx`
Expected: all PASS — these tests render pages directly, so the hook change shouldn't break them.

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/application/useLibrary.ts
git commit -m "refactor(library): extract retry callback from useCatalog"
```

---

## Task 9: Branch `LibraryRoute` on status (with integration tests)

**Files:**
- Modify: `src/ui/organisms/LibraryRoute.tsx`
- Test: `src/ui/organisms/__tests__/LibraryRoute.test.tsx`

- [ ] **Step 1: Write the failing integration test**

Create `src/ui/organisms/__tests__/LibraryRoute.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LibraryRoute } from "../LibraryRoute";
import { LibraryProvider } from "../../../state/LibraryContext";
import { AppProvider } from "../../../state/AppContext";
import type { LibraryClient, LibraryAddPreview } from "../../../application/ports";
import type { Catalog, CatalogTool } from "../../../domain/library";

function makeTool(id: string, overrides: Partial<CatalogTool> = {}): CatalogTool {
  return {
    id,
    name: `T-${id}`,
    version: "1.0.0",
    description: "",
    category: "x",
    outcome: `Does ${id}`,
    permissions: { network: "none", files: "none", system: "none", sentences: [] },
    ...overrides,
  };
}

function makeClient(opts: {
  resolveWith?: Catalog;
  rejectWith?: string;
  defer?: boolean;
}): { client: LibraryClient; resolve: (c: Catalog) => void; reject: (e: string) => void; calls: number } {
  let resolveFn: (c: Catalog) => void = () => {};
  let rejectFn: (e: string) => void = () => {};
  let calls = 0;

  const client: LibraryClient = {
    fetchCatalog: () => {
      calls += 1;
      if (opts.defer) {
        return new Promise<Catalog>((res, rej) => {
          resolveFn = res;
          rejectFn = (msg) => rej(new Error(msg));
        });
      }
      if (opts.rejectWith) return Promise.reject(new Error(opts.rejectWith));
      return Promise.resolve(opts.resolveWith ?? { tools: [], signature: "", signedAt: "" } as unknown as Catalog);
    },
    installAndPreview: vi.fn(async (): Promise<LibraryAddPreview> => ({ before: "", after: "", newTool: {} as never })),
    commitAdd: vi.fn(async () => {}),
    commitRemove: vi.fn(async () => {}),
  };

  return {
    client,
    resolve: (c) => resolveFn(c),
    reject: (e) => rejectFn(e),
    get calls() { return calls; },
  } as never;
}

function renderRoute(client: LibraryClient, view: "landing" | "all" | "detail" = "landing", toolId?: string) {
  return render(
    <AppProvider>
      <LibraryProvider client={client}>
        <LibraryRoute
          selection={view === "detail"
            ? { kind: "library", view, toolId: toolId ?? "x" }
            : { kind: "library", view }}
          onNavigate={() => {}}
          onConfigChanged={() => {}}
        />
      </LibraryProvider>
    </AppProvider>,
  );
}

describe("LibraryRoute", () => {
  it("renders the landing skeleton while loading", () => {
    const { client } = makeClient({ defer: true });
    renderRoute(client, "landing");
    // The skeleton sets aria-busy=true on its outer wrapper.
    const busy = document.querySelector('[aria-busy="true"]');
    expect(busy).not.toBeNull();
    // No real catalog cards yet.
    expect(screen.queryByText("Featured")).toBeNull();
  });

  it("renders the all-tools skeleton while loading on the all view", () => {
    const { client } = makeClient({ defer: true });
    renderRoute(client, "all");
    const busy = document.querySelector('[aria-busy="true"]');
    expect(busy).not.toBeNull();
    // Real back button is rendered (so navigation works during load).
    expect(screen.getByRole("button", { name: /back/i })).toBeInTheDocument();
  });

  it("renders the detail skeleton while loading on the detail view", () => {
    const { client } = makeClient({ defer: true });
    renderRoute(client, "detail", "anything");
    expect(document.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(screen.getByRole("button", { name: /back to library/i })).toBeInTheDocument();
  });

  it("renders the error state and retries on click", async () => {
    const fetchCatalog = vi
      .fn<[], Promise<Catalog>>()
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce({ tools: [makeTool("a", { featured: true })], signature: "", signedAt: "" } as unknown as Catalog);
    const client: LibraryClient = {
      fetchCatalog,
      installAndPreview: vi.fn(),
      commitAdd: vi.fn(),
      commitRemove: vi.fn(),
    } as never;

    renderRoute(client, "landing");

    // Wait for error state
    expect(await screen.findByRole("alert")).toHaveTextContent("boom");

    await userEvent.click(screen.getByRole("button", { name: /try again/i }));

    // Second call resolves; landing should now render the Featured row.
    expect(await screen.findByText("Featured")).toBeInTheDocument();
    expect(fetchCatalog).toHaveBeenCalledTimes(2);
  });

  it("renders the real landing page once the catalog resolves", async () => {
    const client: LibraryClient = {
      fetchCatalog: () => Promise.resolve({ tools: [makeTool("a", { featured: true })], signature: "", signedAt: "" } as unknown as Catalog),
      installAndPreview: vi.fn(),
      commitAdd: vi.fn(),
      commitRemove: vi.fn(),
    } as never;
    renderRoute(client, "landing");
    expect(await screen.findByText("Featured")).toBeInTheDocument();
    expect(document.querySelector('[aria-busy="true"]')).toBeNull();
  });
});
```

If the `Catalog` shape requires fields the test fakes don't provide, replace the `as unknown as Catalog` casts with literal objects that satisfy `Catalog`. Verify the actual type by reading `src/domain/library.ts` and copying its shape — do not invent fields.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/ui/organisms/__tests__/LibraryRoute.test.tsx`
Expected: tests fail because `LibraryRoute` doesn't yet handle `status === "loading" | "error"` (the loading-state assertions and the `try again` flow will both fail).

- [ ] **Step 3: Update `LibraryRoute` to branch on status**

Edit `src/ui/organisms/LibraryRoute.tsx`. Replace the imports block at the top so it includes the new components:

```tsx
import { useMemo, useState } from "react";
import { useApp } from "../../state/AppContext";
import { useAddTool, useCatalog, useRemoveTool } from "../../application/useLibrary";
import type { CatalogTool } from "../../domain/library";
import type { LibrarySelection } from "./Sidebar";
import { LibraryLandingPage } from "../pages/LibraryLandingPage";
import { LibraryAllPage } from "../pages/LibraryAllPage";
import { LibraryToolDetailPage } from "../pages/LibraryToolDetailPage";
import { LibraryLandingSkeleton } from "./LibraryLandingSkeleton";
import { LibraryAllSkeleton } from "./LibraryAllSkeleton";
import { LibraryToolDetailSkeleton } from "./LibraryToolDetailSkeleton";
import { LibraryErrorState } from "../molecules/LibraryErrorState";
```

Then change the function body. The `useCatalog` line currently reads:

```tsx
  const { catalog } = useCatalog();
```

Replace with:

```tsx
  const { status, catalog, error, retry } = useCatalog();
```

Immediately after the `installedIds` `useMemo` (around line 30) and before the `openDetail` declaration, leave navigation helpers as they are. Then, immediately before the existing `if (selection.view === "landing")` block, insert:

```tsx
  if (status === "idle" || status === "loading") {
    if (selection.view === "all")    return <LibraryAllSkeleton onBack={openLanding} />;
    if (selection.view === "detail") return <LibraryToolDetailSkeleton onBack={openLanding} />;
    return <LibraryLandingSkeleton />;
  }

  if (status === "error") {
    return <LibraryErrorState error={error ?? "Failed to load library."} onRetry={retry} />;
  }
```

The rest of the function (the three view branches and `ToolNotFound` helper) is unchanged.

- [ ] **Step 4: Run the full test file**

Run: `npx vitest run src/ui/organisms/__tests__/LibraryRoute.test.tsx`
Expected: all 5 tests PASS.

- [ ] **Step 5: Run the whole frontend test suite**

Run: `npm run test:run`
Expected: full suite passes — no regressions in other library tests.

- [ ] **Step 6: Type-check + production build**

Run: `npx tsc --noEmit && npm run build`
Expected: both succeed.

- [ ] **Step 7: Commit**

```bash
git add src/ui/organisms/LibraryRoute.tsx src/ui/organisms/__tests__/LibraryRoute.test.tsx
git commit -m "feat(library): show skeletons while catalog loads, error state on failure"
```

---

## Task 10: Smoke-test in the running app

**Files:** None (manual verification).

- [ ] **Step 1: Boot the dev app**

Run: `npm run tauri:dev`
Expected: app window opens.

- [ ] **Step 2: Verify each Library view shows its skeleton on cold load**

Click the Library item in the sidebar. The first render should briefly show the landing skeleton (4 row headers + card placeholders pulsing). On a fast local fetch this can be < 50 ms — throttle by temporarily renaming `~/.pier/cache/` if the catalog is cached, or by adding a `await new Promise(r => setTimeout(r, 1500));` at the top of `tauriLibraryClient.ts`'s `fetchCatalog` for the duration of the smoke test only (revert before commit). Repeat with the All view and a Detail deep-link.

- [ ] **Step 3: Verify the error state**

Temporarily make `fetchCatalog` throw (`throw new Error("simulated")` at the top of the adapter), reload the app, confirm the error block + retry button appear, click retry, restore the adapter, click retry again, confirm content loads. Revert the test edit.

- [ ] **Step 4: Visual sanity check**

Confirm the pulse animation is gentle (not strobing), card placeholders match real card dimensions, and there's no layout shift when the real content lands.

- [ ] **Step 5: No commit needed unless you fixed something visual**

If a visual tweak was needed, commit it as `style(library): adjust skeleton ...` with the specific change.

---

## Self-review

**Spec coverage:**
- Skeleton on landing/all/detail — Tasks 5/6/7, wired in Task 9 ✓
- Error state with retry — Task 4 component, Task 8 hook, Task 9 wiring ✓
- New `--animate-pulse-soft` token — Task 1 ✓
- Pages stay pure — confirmed: only `LibraryRoute` and `useLibrary` change ✓
- `LibraryRoute` integration test — Task 9 ✓
- No changes to existing page tests — confirmed (Task 8 step 3 verifies) ✓

**Placeholder scan:** All steps include actual code or actual commands. The only manual step is Task 10 (intentional — it's a smoke test).

**Type consistency:**
- `useCatalog` returns `{ status, catalog, error, retry }` — matches usage in `LibraryRoute` (Task 9) ✓
- `LibraryErrorState` props `{ error: string; onRetry: () => void }` — matches Task 9 call site ✓
- `LibraryAllSkeleton` / `LibraryToolDetailSkeleton` props `{ onBack: () => void }` — matches Task 9 call sites ✓
- `Skeleton` accepts `HTMLAttributes<HTMLDivElement>` — `className` and `style` both supported, used consistently ✓
- `CatalogCardSkeleton` props `{ style?: CSSProperties }` — matches `CatalogCard` in case future code mirrors the staggered animation; not used in skeletons here, kept for parity ✓

**Note on Task 5:** the task body contains a draft and a final version. Implement the *second* (final) version. The draft is shown to make the corrected import list obvious.
