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
