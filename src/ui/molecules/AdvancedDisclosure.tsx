import { useState } from "react";
import { ChevronRight } from "lucide-react";
import type { Parameter, ParamValue } from "../../domain/tool";
import type { ValidationError } from "../../domain/paramValidation";
import { ParamField } from "./ParamField";
import { summarizeAdvanced } from "../../application/summarizeAdvanced";

interface Props {
  params: Parameter[];
  values: Record<string, ParamValue>;
  errors?: Map<string, ValidationError>;
  onChange: (id: string, value: ParamValue) => void;
}

export function AdvancedDisclosure({ params, values, errors, onChange }: Props) {
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
          className={`flex-none w-[14px] flex items-center justify-center text-ink-3 transition-transform duration-150 ease-(--ease-smooth) origin-center ${
            open ? "rotate-90" : ""
          }`}
        >
          <ChevronRight size={14} strokeWidth={2.25} />
        </span>
        <span className="font-display text-[14px] text-ink-2 group-hover:text-ink">
          {open ? "Advanced options" : summary}
        </span>
        <span className="flex-1 h-px bg-line" />
      </button>

      <div
        className={`grid transition-[grid-template-rows,opacity] duration-[220ms] ease-(--ease-smooth-out) ${
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
        aria-hidden={!open}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="flex flex-col gap-7 pl-6 pt-1">
            {params.map((p, i) => (
              <ParamField
                key={p.id}
                param={p}
                index={i}
                value={values[p.id]}
                error={errors?.get(p.id)}
                onChange={v => onChange(p.id, v)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
