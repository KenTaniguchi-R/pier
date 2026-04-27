import { ButtonHTMLAttributes } from "react";

interface Props extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> {
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: string;
}

const TRACK_BASE =
  "relative inline-flex items-center w-[40px] h-[22px] rounded-pill border " +
  "transition-[background-color,border-color] duration-200 ease-(--ease-smooth) " +
  "focus-visible:outline-none focus-visible:shadow-[0_0_0_4px_var(--color-accent-soft)] " +
  "disabled:opacity-40 disabled:cursor-not-allowed";

const TRACK_OFF = "bg-bg-2 border-line-hi hover:border-ink-4";
const TRACK_ON = "bg-accent border-accent";

const KNOB_BASE =
  "absolute top-[2px] left-[2px] w-[16px] h-[16px] rounded-pill bg-surface " +
  "shadow-[0_1px_2px_rgba(31,26,22,0.18),0_0_0_0.5px_rgba(31,26,22,0.06)] " +
  "transition-transform duration-200 ease-(--ease-smooth-out)";

export function Switch({ checked, onChange, label, className = "", disabled, ...rest }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`${TRACK_BASE} ${checked ? TRACK_ON : TRACK_OFF} ${className}`}
      {...rest}
    >
      <span
        className={KNOB_BASE}
        style={{ transform: checked ? "translateX(18px)" : "translateX(0)" }}
        aria-hidden
      />
    </button>
  );
}
