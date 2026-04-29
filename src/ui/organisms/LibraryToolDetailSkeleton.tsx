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
