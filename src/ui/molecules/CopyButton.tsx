import { useEffect, useRef, useState } from "react";

interface Props {
  getText: () => string;
  label?: string;
  className?: string;
}

type State = "idle" | "copied" | "failed";

export function CopyButton({ getText, label = "copy", className = "" }: Props) {
  const [state, setState] = useState<State>("idle");
  const timer = useRef<number | null>(null);

  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);

  async function handleCopy() {
    const text = getText();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
    } catch {
      setState("failed");
    }
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState("idle"), 1400);
  }

  const isCopied = state === "copied";
  const isFailed = state === "failed";
  const display = isCopied ? "copied" : isFailed ? "failed" : label;

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label="Copy output to clipboard"
      className={
        "group inline-flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.18em] " +
        "px-1.5 py-1 -my-1 rounded-1 cursor-pointer select-none " +
        "transition-colors duration-150 ease-(--ease-smooth) " +
        (isCopied
          ? "text-success"
          : isFailed
          ? "text-danger"
          : "text-ink-4 hover:text-ink-2") +
        " " +
        className
      }
    >
      <span aria-hidden className="relative inline-block size-[11px]">
        {/* copy glyph: two stacked rounded squares */}
        <span
          className={
            "absolute inset-0 transition-[opacity,transform] duration-150 ease-(--ease-smooth) " +
            (isCopied ? "opacity-0 scale-75" : "opacity-100 scale-100")
          }
        >
          <span className="absolute left-0 top-0 size-[8px] rounded-[2px] border border-current" />
          <span className="absolute right-0 bottom-0 size-[8px] rounded-[2px] border border-current bg-(--color-bg)" />
        </span>
        {/* check glyph */}
        <svg
          viewBox="0 0 11 11"
          className={
            "absolute inset-0 transition-[opacity,transform] duration-150 ease-(--ease-smooth) " +
            (isCopied ? "opacity-100 scale-100" : "opacity-0 scale-75")
          }
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M2 6 L4.5 8.5 L9 3" />
        </svg>
      </span>
      <span>{display}</span>
    </button>
  );
}
