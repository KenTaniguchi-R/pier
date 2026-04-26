import { HTMLAttributes, ReactNode } from "react";

type Variant = "neutral" | "success" | "warning" | "danger" | "info";

interface Props extends HTMLAttributes<HTMLSpanElement> {
  variant?: Variant;
  children: ReactNode;
}

const BASE =
  "inline-flex items-center gap-1 font-body font-semibold text-[12px] leading-none " +
  "px-2.5 py-[5px] rounded-pill border whitespace-nowrap";

const VARIANTS: Record<Variant, string> = {
  neutral: "bg-bg-2 text-ink-2 border-line",
  success: "bg-success-soft text-success border-transparent",
  warning: "bg-warning-soft text-warning border-transparent",
  danger:  "bg-danger-soft text-danger border-transparent",
  info:    "bg-accent-soft text-accent border-transparent",
};

export function Badge({
  variant = "neutral",
  className = "",
  children,
  ...rest
}: Props) {
  return (
    <span
      className={`${BASE} ${VARIANTS[variant]} ${className}`}
      {...rest}
    >
      {children}
    </span>
  );
}
