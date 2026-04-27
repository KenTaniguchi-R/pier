import { forwardRef } from "react";

interface Props {
  query: string;
  onQueryChange: (q: string) => void;
  total: number;
  active: number; // 1-based; 0 when no matches
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
}

const INPUT =
  "flex-1 bg-transparent outline-none border-none font-mono text-[12px] " +
  "text-ink placeholder:text-ink-4";

const NAV_BTN =
  "size-6 rounded-1 grid place-items-center text-ink-3 " +
  "hover:bg-bg-2 hover:text-ink disabled:opacity-40 disabled:hover:bg-transparent " +
  "disabled:hover:text-ink-3 transition-colors duration-150 ease-(--ease-smooth)";

export const LogSearchBar = forwardRef<HTMLInputElement, Props>(function LogSearchBar(
  { query, onQueryChange, total, active, onPrev, onNext, onClose },
  ref,
) {
  const noMatches = query.length > 0 && total === 0;
  const countText = query.length === 0 ? "" : total === 0 ? "no matches" : `${active} / ${total}`;

  return (
    <div
      className={
        "sticky top-0 z-10 flex items-center gap-2 px-5 py-2 " +
        "bg-surface/85 backdrop-blur-sm border-b border-line"
      }
    >
      <div
        className={
          "flex items-center gap-2 flex-1 h-7 px-3 rounded-pill " +
          "bg-bg-2 border " +
          (noMatches ? "border-danger/50" : "border-line focus-within:border-accent-edge focus-within:bg-surface")
        }
      >
        <span aria-hidden className="text-ink-4 text-[12px] leading-none translate-y-[-1px]">
          ⌕
        </span>
        <input
          ref={ref}
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="find in output"
          aria-label="Find in output"
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="off"
          className={INPUT}
        />
      </div>

      <span
        aria-live="polite"
        className={
          "font-mono text-[11px] tabular-nums min-w-[5ch] text-right " +
          (noMatches ? "text-ink-4" : "text-ink-3")
        }
      >
        {countText}
      </span>

      <div className="flex items-center gap-0.5">
        <button
          type="button"
          aria-label="Previous match"
          onClick={onPrev}
          disabled={total === 0}
          className={NAV_BTN}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
            <path d="M2 6 L5 3 L8 6" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button
          type="button"
          aria-label="Next match"
          onClick={onNext}
          disabled={total === 0}
          className={NAV_BTN}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
            <path d="M2 4 L5 7 L8 4" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button
          type="button"
          aria-label="Close search"
          onClick={onClose}
          className={NAV_BTN}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
            <path d="M2 2 L8 8 M8 2 L2 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  );
});
