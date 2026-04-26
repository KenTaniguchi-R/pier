import { InputHTMLAttributes } from "react";

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  min?: number; max?: number; step?: number;
}

const BASE =
  "w-full font-mono tabular-nums text-right text-[13px] leading-[1.5] " +
  "bg-surface text-ink border border-line rounded-[10px] px-3 py-2.5 " +
  "transition-[border-color,box-shadow] duration-200 ease-(--ease-smooth) " +
  "placeholder:text-ink-4 " +
  "focus:outline-none focus:border-accent-edge focus:shadow-[0_0_0_4px_var(--color-accent-soft)]";

export function NumberField({ className = "", ...rest }: Props) {
  return (
    <input
      type="number"
      inputMode="numeric"
      className={`${BASE} ${className}`}
      {...rest}
    />
  );
}
