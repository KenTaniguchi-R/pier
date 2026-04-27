import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  tallyMatches,
  locateActiveMatch,
  type ActiveMatchLocation,
} from "../../domain/logSegments";

interface Options {
  /** Lines to search through. */
  lines: readonly string[];
  /** Reset search state when this changes (e.g., active runId). */
  resetKey: string | undefined;
  /** Whether the host is mounted and should respond to global shortcuts. */
  enabled: boolean;
}

interface Api {
  open: boolean;
  query: string;
  /** Stable, useDeferredValue-wrapped query for expensive derivations. */
  deferredQuery: string;
  /** Active match index, 0-based. */
  active: number;
  /** Total matches across all lines for the current query. */
  total: number;
  /** Where the active match lives, or null when there is none. */
  activeLocation: ActiveMatchLocation | null;
  inputRef: React.RefObject<HTMLInputElement | null>;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  setQuery: (q: string) => void;
  next: () => void;
  prev: () => void;
  openSearch: () => void;
  closeSearch: () => void;
}

/**
 * UI state + keyboard wiring for in-output search. Owns tallying so the
 * caller doesn't have to thread `total` back in to clamp `active`.
 * Active-match scrolling is delegated to a `data-pier-match="active"` attribute.
 */
export function useLogSearch({ lines, resetKey, enabled }: Options): Api {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const deferredQuery = useDeferredValue(query);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { perLine, total } = useMemo(
    () => tallyMatches(lines, deferredQuery),
    [lines, deferredQuery],
  );

  // Reset when the underlying run changes.
  useEffect(() => {
    setOpen(false);
    setQuery("");
    setActive(0);
  }, [resetKey]);

  // Clamp active when total shrinks.
  useEffect(() => {
    if (total === 0) setActive(0);
    else if (active >= total) setActive(total - 1);
  }, [total, active]);

  const closeSearch = useCallback(() => {
    setOpen(false);
    setQuery("");
    setActive(0);
  }, []);

  const openSearch = useCallback(() => {
    setOpen(true);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  }, []);

  const next = useCallback(() => {
    setActive(a => (total === 0 ? 0 : (a + 1) % total));
  }, [total]);

  const prev = useCallback(() => {
    setActive(a => (total === 0 ? 0 : (a - 1 + total) % total));
  }, [total]);

  const setQueryAndReset = useCallback((q: string) => {
    setQuery(q);
    setActive(0);
  }, []);

  // Global keyboard shortcuts: ⌘F open, Esc close, ⌘G / Enter cycle.
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "f") {
        e.preventDefault();
        openSearch();
        return;
      }
      if (!open) return;
      if (e.key === "Escape") {
        e.preventDefault();
        closeSearch();
      } else if (mod && e.key.toLowerCase() === "g") {
        e.preventDefault();
        e.shiftKey ? prev() : next();
      } else if (e.key === "Enter" && document.activeElement === inputRef.current) {
        e.preventDefault();
        e.shiftKey ? prev() : next();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled, open, openSearch, closeSearch, next, prev]);

  // Scroll the active match into view.
  useEffect(() => {
    if (!open || total === 0) return;
    const el = scrollRef.current?.querySelector<HTMLElement>('[data-pier-match="active"]');
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [active, open, total, deferredQuery]);

  const activeLocation =
    deferredQuery && total > 0 ? locateActiveMatch(perLine, active) : null;

  return {
    open,
    query,
    deferredQuery,
    active,
    total,
    activeLocation,
    inputRef,
    scrollRef,
    setQuery: setQueryAndReset,
    next,
    prev,
    openSearch,
    closeSearch,
  };
}
