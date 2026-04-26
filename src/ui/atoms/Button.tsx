import { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "ghost" | "danger";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const BASE =
  "inline-flex items-center justify-center gap-1 font-body font-semibold text-[13px] leading-none px-4 py-2.5 border border-transparent rounded-[10px] cursor-pointer select-none shadow-1 " +
  "transition-[background-color,border-color,transform,box-shadow] duration-100 ease-(--ease-smooth) " +
  "active:translate-y-px disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-accent text-white border-accent shadow-2 " +
    "hover:brightness-105 hover:shadow-3 " +
    "disabled:bg-ink-4 disabled:border-ink-4 disabled:brightness-100",
  ghost:
    "bg-transparent border-line text-ink-2 shadow-none " +
    "hover:bg-bg-2 hover:text-ink hover:border-line-hi",
  danger:
    "bg-danger text-white border-danger hover:brightness-105",
};

export function Button({
  variant = "primary",
  className = "",
  ...rest
}: Props) {
  return (
    <button
      className={`${BASE} ${VARIANTS[variant]} ${className}`}
      {...rest}
    />
  );
}
