import { TextareaHTMLAttributes } from "react";

type Variant = "default";

interface Props extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  variant?: Variant;
}

const BASE =
  "w-full min-h-[88px] resize-y font-body font-normal text-[14px] leading-[1.55] " +
  "bg-surface text-ink border border-line rounded-[10px] px-3 py-2.5 " +
  "transition-[border-color,box-shadow] duration-200 ease-(--ease-smooth) " +
  "placeholder:text-ink-4 " +
  "focus:outline-none focus:border-accent-edge focus:shadow-[0_0_0_4px_var(--color-accent-soft)]";

export function Textarea({
  className = "",
  ...rest
}: Props) {
  return <textarea className={`${BASE} ${className}`} {...rest} />;
}
