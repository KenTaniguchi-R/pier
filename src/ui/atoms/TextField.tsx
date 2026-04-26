import { InputHTMLAttributes } from "react";

type Variant = "default" | "compact";

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  variant?: Variant;
}

export function TextField({
  variant = "default",
  className = "",
  ...rest
}: Props) {
  return (
    <input
      type="text"
      className={`text-field text-field-${variant} ${className}`}
      {...rest}
    />
  );
}
