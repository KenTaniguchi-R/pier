import { useState } from "react";
import type { Parameter, ParamValue } from "../../domain/tool";
import { ParamField } from "./ParamField";
import { summarizeAdvanced } from "../../application/summarizeAdvanced";

interface Props {
  params: Parameter[];
  values: Record<string, ParamValue>;
  onChange: (id: string, value: ParamValue) => void;
}

export function AdvancedDisclosure({ params, values, onChange }: Props) {
  const [open, setOpen] = useState(false);
  if (params.length === 0) return null;
  const summary = summarizeAdvanced(params, values);

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="flex items-center gap-3 bg-transparent border-none p-0 text-left cursor-pointer group"
      >
        <span
          aria-hidden
          className={`inline-block w-3 transition-transform text-ink-3 ${open ? "rotate-90" : ""}`}
        >
          ▸
        </span>
        <span className="font-display text-[14px] text-ink-2 group-hover:text-ink">
          {open ? "Advanced options" : summary}
        </span>
        <span className="flex-1 h-px bg-line" />
      </button>

      {open && (
        <div className="flex flex-col gap-7 pl-6">
          {params.map((p, i) => (
            <ParamField
              key={p.id}
              param={p}
              index={i}
              value={values[p.id]}
              onChange={v => onChange(p.id, v)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
