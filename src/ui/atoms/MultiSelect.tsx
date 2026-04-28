import { Check } from "lucide-react";

interface Props {
  options: string[];
  value: string[];
  onChange: (next: string[]) => void;
  "aria-label"?: string;
}

const ROW =
  "flex items-center gap-2.5 cursor-pointer select-none px-2.5 py-1.5 " +
  "rounded-[8px] hover:bg-bg-2 transition-colors duration-150";

const BOX_BASE =
  "inline-flex items-center justify-center w-[14px] h-[14px] " +
  "rounded-[4px] shadow-1 border " +
  "transition-[background-color,border-color,box-shadow] duration-150 ease-(--ease-smooth)";

const BOX_OFF = "bg-surface border-line-hi";
const BOX_ON  = "bg-accent border-accent";

export function MultiSelect({ options, value, onChange, ...rest }: Props) {
  const set = new Set(value);
  const toggle = (opt: string) => {
    const next = new Set(set);
    next.has(opt) ? next.delete(opt) : next.add(opt);
    // Preserve original options order.
    onChange(options.filter(o => next.has(o)));
  };

  return (
    <div
      role="group"
      aria-label={rest["aria-label"]}
      className="flex flex-col gap-0.5 border border-line rounded-[10px] p-1.5 bg-surface"
    >
      {options.map(opt => {
        const on = set.has(opt);
        return (
          <label key={opt} className={ROW}>
            <input
              type="checkbox"
              className="sr-only"
              checked={on}
              onChange={() => toggle(opt)}
            />
            <span className={`${BOX_BASE} ${on ? BOX_ON : BOX_OFF}`}>
              {on && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} aria-hidden />}
            </span>
            <span className="font-body text-[13.5px] text-ink">{opt}</span>
          </label>
        );
      })}
    </div>
  );
}
