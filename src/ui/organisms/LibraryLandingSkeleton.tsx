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
