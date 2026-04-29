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
