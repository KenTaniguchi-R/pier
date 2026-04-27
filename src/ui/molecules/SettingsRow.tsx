import type { ReactNode } from "react";

interface Props {
  icon?: ReactNode;
  title: string;
  subtitle?: string;
  control?: ReactNode;
}

/** A single row inside a SettingsSection: icon · title/subtitle · control. */
export function SettingsRow({ icon, title, subtitle, control }: Props) {
  return (
    <div className="flex items-center gap-4 pl-5 pr-4 py-4">
      {icon && (
        <span className="flex-none w-7 h-7 rounded-pill bg-bg-2 border border-line flex items-center justify-center text-ink-3">
          {icon}
        </span>
      )}
      <div className="flex-1 min-w-0">
        <div className="font-display text-[15px] leading-[1.2] text-ink font-semibold tracking-[-0.005em]">
          {title}
        </div>
        {subtitle && (
          <div className="font-mono text-[11px] leading-[1.4] text-ink-3 mt-1">
            {subtitle}
          </div>
        )}
      </div>
      {control !== undefined && <div className="flex-none">{control}</div>}
    </div>
  );
}
