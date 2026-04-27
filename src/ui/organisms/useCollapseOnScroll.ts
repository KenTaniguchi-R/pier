import { useEffect, useRef, useState } from "react";

const COLLAPSE_AT = 24;
const EXPAND_AT = 4;
// Approximate height of the collapsed header (single inline row + paddings).
// Used to gate collapsing so it never eliminates the overflow that triggered it.
const COLLAPSED_HEIGHT_APPROX = 44;
const OVERFLOW_BUFFER = 16;

/**
 * Collapses a header when its sibling scroll container is scrolled past a
 * threshold. Guards against the oscillation that happens when collapsing the
 * header removes the overflow that triggered the collapse in the first place.
 *
 * Reset by changing `resetKey`.
 */
export function useCollapseOnScroll<H extends HTMLElement, S extends HTMLElement>(resetKey: unknown) {
  const headerRef = useRef<H>(null);
  const scrollRef = useRef<S>(null);
  const expandedHRef = useRef(0);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      setCollapsed((prev) => {
        if (prev) return el.scrollTop > EXPAND_AT;
        if (headerRef.current) expandedHRef.current = headerRef.current.offsetHeight;
        if (el.scrollTop <= COLLAPSE_AT) return false;
        const headerDelta = Math.max(0, expandedHRef.current - COLLAPSED_HEIGHT_APPROX);
        const overflow = el.scrollHeight - el.clientHeight;
        return overflow > headerDelta + OVERFLOW_BUFFER;
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [resetKey]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
    setCollapsed(false);
  }, [resetKey]);

  return { headerRef, scrollRef, collapsed };
}
