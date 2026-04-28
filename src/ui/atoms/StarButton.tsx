import { Star } from "lucide-react";
import type { MouseEvent } from "react";

interface Props {
  pinned: boolean;
  onToggle: () => void;
  /** When true, the button is shown only on parent hover/focus (still visible
   *  when pinned). The parent must provide a `group` class. */
  hoverOnly?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
  title?: string;
}

export function StarButton({
  pinned,
  onToggle,
  hoverOnly = false,
  disabled = false,
  ariaLabel,
  title,
}: Props) {
  const handle = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    e.preventDefault();
    if (!disabled) onToggle();
  };

  const visibility = hoverOnly && !pinned
    ? "opacity-0 group-hover:opacity-100 focus:opacity-100"
    : "opacity-100";

  const tone = pinned
    ? "text-accent"
    : disabled
      ? "text-ink-4"
      : "text-ink-3 hover:text-ink";

  return (
    <button
      type="button"
      onClick={handle}
      disabled={disabled}
      aria-pressed={pinned}
      aria-label={ariaLabel ?? (pinned ? "Unpin from favorites" : "Pin to favorites")}
      title={title ?? (pinned ? "Unpin" : disabled ? "Favorites full" : "Pin to favorites")}
      className={`inline-flex items-center justify-center w-6 h-6 rounded-[6px] bg-transparent border-none cursor-pointer transition-[opacity,color] duration-150 ease-(--ease-smooth) disabled:cursor-not-allowed ${visibility} ${tone}`}
    >
      <Star
        size={14}
        strokeWidth={2}
        fill={pinned ? "currentColor" : "none"}
        aria-hidden
      />
    </button>
  );
}
