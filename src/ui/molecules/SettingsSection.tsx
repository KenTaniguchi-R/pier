import type { ReactNode } from "react";

interface Props {
  kicker: string;
  label: string;
  children: ReactNode;
}

/**
 * One labelled card group on the Settings page. Left rail: italic kicker
 * (e.g. "01.") + mono section label. Right: surface card containing rows.
 */
export function SettingsSection({ kicker, label, children }: Props) {
  return (
    <section className="grid grid-cols-[88px_1fr] gap-7 items-start animate-tile-in">
      <div className="flex flex-col pt-1">
        <span className="font-display italic text-[26px] text-ink-3 leading-none">
          {kicker}.
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-2 mt-2">
          {label}
        </span>
      </div>
      <div className="bg-surface border border-line rounded-[14px] shadow-1 overflow-hidden">
        {children}
      </div>
    </section>
  );
}
