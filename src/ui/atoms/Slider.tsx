import { InputHTMLAttributes } from "react";

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  min: number;
  max: number;
  step?: number;
}

const TRACK =
  "w-full appearance-none h-1.5 rounded-pill bg-line-hi " +
  "focus:outline-none focus:shadow-[0_0_0_4px_var(--color-accent-soft)] " +
  "[&::-webkit-slider-thumb]:appearance-none " +
  "[&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 " +
  "[&::-webkit-slider-thumb]:rounded-pill [&::-webkit-slider-thumb]:bg-accent " +
  "[&::-webkit-slider-thumb]:shadow-1 " +
  "[&::-webkit-slider-thumb]:transition-[transform] " +
  "[&::-webkit-slider-thumb]:duration-150 " +
  "active:[&::-webkit-slider-thumb]:scale-110";

export function Slider({ value, min, max, step, className = "", ...rest }: Props) {
  return (
    <div className="flex items-center gap-3">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        className={`${TRACK} ${className}`}
        {...rest}
      />
      <span className="font-mono tabular-nums text-[12px] text-ink-2 min-w-[3ch] text-right">
        {value}
      </span>
    </div>
  );
}
