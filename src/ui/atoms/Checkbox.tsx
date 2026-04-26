import { InputHTMLAttributes } from "react";

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
}

const WRAP = "inline-flex items-center gap-2.5 cursor-pointer select-none";

const BOX_BASE =
  "inline-flex items-center justify-center w-[14px] h-[14px] " +
  "rounded-[4px] shadow-1 border " +
  "transition-[background-color,border-color,box-shadow] duration-150 ease-(--ease-smooth)";

const BOX_OFF = "bg-surface border-line-hi hover:border-ink-4";
const BOX_ON  = "bg-accent border-accent";

const LABEL = "font-mono text-[11px] uppercase tracking-[0.16em] text-ink-2";

export function Checkbox({ label, checked, className = "", ...rest }: Props) {
  return (
    <label className={`${WRAP} ${className}`}>
      <input type="checkbox" className="sr-only" checked={checked} {...rest} />
      <span className={`${BOX_BASE} ${checked ? BOX_ON : BOX_OFF}`}>
        {checked && (
          <svg className="w-2 h-2 text-white" viewBox="0 0 8 8" aria-hidden>
            <path d="M1 4l2 2 4-5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      {label && <span className={LABEL}>{label}</span>}
    </label>
  );
}
