import type { ReactNode } from "react";

interface Props {
  label: string;
  /** Right-aligned meta string (e.g., "3/8" or "12 entries"). */
  meta?: ReactNode;
}

/** Section header with a small-caps label, hairline rule, and optional meta.
 *  Visual rhythm shared by Home strips and per-tool history. */
export function StripHeader({ label, meta }: Props) {
  return (
    <div className="flex items-center gap-3">
      <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink-3">
        {label}
      </span>
      <span className="flex-1 h-px bg-line" />
      {meta != null && (
        <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-4 tabular-nums">
          {meta}
        </span>
      )}
    </div>
  );
}
