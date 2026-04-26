import { SelectHTMLAttributes } from "react";

interface Props extends SelectHTMLAttributes<HTMLSelectElement> {
  options: string[];
}

const BASE =
  "w-full appearance-none font-body font-normal text-[14px] leading-[1.5] " +
  "bg-surface text-ink border border-line rounded-[10px] px-3 py-2.5 pr-9 " +
  "transition-[border-color,box-shadow,background-color] duration-200 ease-(--ease-smooth) " +
  "focus:outline-none focus:border-accent-edge focus:shadow-[0_0_0_4px_var(--color-accent-soft)] " +
  "disabled:opacity-60 disabled:cursor-not-allowed";

const CHEVRON =
  "pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 " +
  "w-3 h-3 text-ink-3";

export function Select({ options, className = "", ...rest }: Props) {
  return (
    <span className="relative block">
      <select className={`${BASE} ${className}`} {...rest}>
        {options.map(o => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
      <svg className={CHEVRON} viewBox="0 0 12 12" aria-hidden>
        <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}
