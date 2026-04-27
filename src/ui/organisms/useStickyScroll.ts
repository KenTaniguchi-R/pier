import { useCallback, useEffect, useRef, useState } from "react";

interface Options {
  scrollRef: React.RefObject<HTMLDivElement | null>;
  /** Changes when new content is appended (e.g. line count). */
  contentKey: number;
  /** Changes when the underlying run swaps; resets pin state. */
  resetKey: string | undefined;
  /** Pixel threshold for "near bottom". */
  threshold?: number;
  /** Whether the host is mounted and should respond to global shortcuts. */
  enabled?: boolean;
}

interface Api {
  isPinned: boolean;
  hasNewBelow: boolean;
  jumpToBottom: () => void;
}

function distanceFromBottom(el: HTMLElement): number {
  return el.scrollHeight - el.scrollTop - el.clientHeight;
}

/**
 * Sticky-bottom autoscroll for a scrollable container.
 *
 * Standard terminal/log-viewer behavior: follow the tail when the user is
 * near the bottom; pause auto-scroll when they scroll up; expose
 * `hasNewBelow` so the host can show a "jump to latest" affordance.
 */
export function useStickyScroll({
  scrollRef,
  contentKey,
  resetKey,
  threshold = 40,
  enabled = true,
}: Options): Api {
  const [isPinned, setIsPinned] = useState(true);
  const [hasNewBelow, setHasNewBelow] = useState(false);
  const isPinnedRef = useRef(true);
  isPinnedRef.current = isPinned;

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [scrollRef]);

  const jumpToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    setIsPinned(true);
    setHasNewBelow(false);
  }, [scrollRef]);

  // Reset on run change: snap to bottom, re-pin.
  useEffect(() => {
    setIsPinned(true);
    setHasNewBelow(false);
    requestAnimationFrame(scrollToBottom);
  }, [resetKey, scrollToBottom]);

  // On new content: follow if pinned; otherwise mark "new below".
  useEffect(() => {
    if (isPinnedRef.current) {
      scrollToBottom();
    } else {
      setHasNewBelow(true);
    }
  }, [contentKey, scrollToBottom]);

  // Track pin state from user scrolls.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const pinned = distanceFromBottom(el) <= threshold;
      setIsPinned(pinned);
      if (pinned) setHasNewBelow(false);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [scrollRef, threshold]);

  // Cmd/Ctrl+End → jump to latest.
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === "End") {
        e.preventDefault();
        jumpToBottom();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled, jumpToBottom]);

  return { isPinned, hasNewBelow, jumpToBottom };
}
