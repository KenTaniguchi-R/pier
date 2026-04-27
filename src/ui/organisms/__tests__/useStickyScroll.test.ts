import { describe, it, expect, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useRef } from "react";
import { useStickyScroll } from "../useStickyScroll";

interface FakeScroll {
  el: HTMLDivElement;
  setHeight: (n: number) => void;
  setClient: (n: number) => void;
  setTop: (n: number) => void;
}

function makeScrollEl(initial: {
  scrollHeight: number;
  clientHeight: number;
  scrollTop: number;
}): FakeScroll {
  const state = { ...initial };
  const el = document.createElement("div");
  Object.defineProperty(el, "scrollHeight", { configurable: true, get: () => state.scrollHeight });
  Object.defineProperty(el, "clientHeight", { configurable: true, get: () => state.clientHeight });
  Object.defineProperty(el, "scrollTop", {
    configurable: true,
    get: () => state.scrollTop,
    set: v => { state.scrollTop = v; },
  });
  el.scrollTo = ((arg: number | ScrollToOptions = {}) => {
    if (typeof arg === "object" && arg.top != null) state.scrollTop = arg.top;
  }) as HTMLElement["scrollTo"];
  return {
    el,
    setHeight: n => { state.scrollHeight = n; },
    setClient: n => { state.clientHeight = n; },
    setTop: n => { state.scrollTop = n; },
  };
}

function setupHook(el: HTMLDivElement) {
  return renderHook(
    ({ contentKey, resetKey }: { contentKey: number; resetKey: string }) => {
      const ref = useRef<HTMLDivElement | null>(el);
      return useStickyScroll({ scrollRef: ref, contentKey, resetKey });
    },
    { initialProps: { contentKey: 0, resetKey: "run-1" } },
  );
}

describe("useStickyScroll", () => {
  beforeEach(() => {
    // jsdom lacks rAF in some setups; ensure it exists.
    globalThis.requestAnimationFrame = (cb: FrameRequestCallback) =>
      setTimeout(() => cb(performance.now()), 0) as unknown as number;
  });

  it("starts pinned and follows new content to the bottom", async () => {
    const fs = makeScrollEl({ scrollHeight: 1000, clientHeight: 200, scrollTop: 800 });
    const { result, rerender } = setupHook(fs.el);

    expect(result.current.isPinned).toBe(true);

    fs.setHeight(1200);
    rerender({ contentKey: 1, resetKey: "run-1" });

    expect(fs.el.scrollTop).toBe(1200);
    expect(result.current.hasNewBelow).toBe(false);
  });

  it("unpins when the user scrolls away from the bottom", () => {
    const fs = makeScrollEl({ scrollHeight: 1000, clientHeight: 200, scrollTop: 800 });
    const { result } = setupHook(fs.el);

    act(() => {
      fs.setTop(100);
      fs.el.dispatchEvent(new Event("scroll"));
    });

    expect(result.current.isPinned).toBe(false);
  });

  it("flags hasNewBelow when content arrives while unpinned", () => {
    const fs = makeScrollEl({ scrollHeight: 1000, clientHeight: 200, scrollTop: 100 });
    const { result, rerender } = setupHook(fs.el);

    act(() => {
      fs.setTop(100);
      fs.el.dispatchEvent(new Event("scroll"));
    });
    expect(result.current.isPinned).toBe(false);

    fs.setHeight(1200);
    rerender({ contentKey: 1, resetKey: "run-1" });

    expect(fs.el.scrollTop).toBe(100);
    expect(result.current.hasNewBelow).toBe(true);
  });

  it("re-pins and clears hasNewBelow on jumpToBottom", () => {
    const fs = makeScrollEl({ scrollHeight: 1200, clientHeight: 200, scrollTop: 100 });
    const { result, rerender } = setupHook(fs.el);
    act(() => {
      fs.setTop(100);
      fs.el.dispatchEvent(new Event("scroll"));
    });
    fs.setHeight(1400);
    rerender({ contentKey: 1, resetKey: "run-1" });
    expect(result.current.hasNewBelow).toBe(true);

    act(() => { result.current.jumpToBottom(); });

    expect(result.current.isPinned).toBe(true);
    expect(result.current.hasNewBelow).toBe(false);
  });

  it("resets pin state and snaps to bottom on resetKey change (new run)", async () => {
    const fs = makeScrollEl({ scrollHeight: 1000, clientHeight: 200, scrollTop: 100 });
    const { result, rerender } = setupHook(fs.el);
    act(() => {
      fs.setTop(100);
      fs.el.dispatchEvent(new Event("scroll"));
    });
    expect(result.current.isPinned).toBe(false);

    fs.setHeight(500);
    await act(async () => {
      rerender({ contentKey: 0, resetKey: "run-2" });
      await new Promise(r => setTimeout(r, 0));
    });

    expect(result.current.isPinned).toBe(true);
    expect(fs.el.scrollTop).toBe(500);
  });
});
