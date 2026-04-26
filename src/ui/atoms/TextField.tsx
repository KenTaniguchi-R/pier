import { InputHTMLAttributes } from "react";

type Variant = "default" | "compact";

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  variant?: Variant;
}

const BASE =
  "w-full font-body font-normal bg-surface text-ink border border-line rounded-[10px] " +
  "transition-[border-color,box-shadow,background-color] duration-200 ease-(--ease-smooth) " +
  "placeholder:text-ink-4 " +
  "focus:outline-none focus:border-accent-edge focus:shadow-[0_0_0_4px_var(--color-accent-soft)]";

const VARIANTS: Record<Variant, string> = {
  default: "text-[14px] leading-[1.5] px-3 py-2.5",
  compact: "text-[13px] px-2.5 py-1.5",
};

export function TextField({
  variant = "default",
  className = "",
  ...rest
}: Props) {
  return (
    <input
      type="text"
      className={`${BASE} ${VARIANTS[variant]} ${className}`}
      {...rest}
    />
  );
}
