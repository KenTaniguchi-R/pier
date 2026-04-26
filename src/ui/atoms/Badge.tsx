import { HTMLAttributes, ReactNode } from "react";

type Variant = "neutral" | "success" | "warning" | "danger" | "info";

interface Props extends HTMLAttributes<HTMLSpanElement> {
  variant?: Variant;
  children: ReactNode;
}

export function Badge({
  variant = "neutral",
  className = "",
  children,
  ...rest
}: Props) {
  return (
    <span
      className={`badge badge-${variant} ${className}`}
      {...rest}
    >
      {children}
    </span>
  );
}
