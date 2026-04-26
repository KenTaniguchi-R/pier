import { TextareaHTMLAttributes } from "react";

type Variant = "default";

interface Props extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  variant?: Variant;
}

export function Textarea({
  variant = "default",
  className = "",
  ...rest
}: Props) {
  return (
    <textarea
      className={`textarea textarea-${variant} ${className}`}
      {...rest}
    />
  );
}
