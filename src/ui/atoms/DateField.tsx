import { InputHTMLAttributes } from "react";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

const BASE =
  "w-full font-mono tabular-nums text-[13px] leading-[1.5] " +
  "bg-surface text-ink border border-line rounded-[10px] px-3 py-2.5 " +
  "transition-[border-color,box-shadow] duration-200 ease-(--ease-smooth) " +
  "focus:outline-none focus:border-accent-edge focus:shadow-[0_0_0_4px_var(--color-accent-soft)]";

export function DateField({ className = "", ...rest }: Props) {
  return <input type="date" className={`${BASE} ${className}`} {...rest} />;
}
