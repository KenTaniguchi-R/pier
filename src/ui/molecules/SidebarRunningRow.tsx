import { SidebarItem } from "./SidebarItem";
import { formatElapsed } from "./elapsed";

interface Props {
  label: string;
  startedAt: number;
  now: number;
  active: boolean;
  onClick: () => void;
}

export function SidebarRunningRow({ label, startedAt, now, active, onClick }: Props) {
  return (
    <div className="animate-tile-in">
      <SidebarItem
        label={label}
        active={active}
        onClick={onClick}
        leading={
          <span className="relative flex-none w-1.5 h-1.5" aria-hidden>
            <span className="absolute inset-0 rounded-full bg-accent/40 animate-run-pulse" />
            <span className="absolute inset-0 rounded-full bg-accent" />
          </span>
        }
        trailing={
          <span className="flex-none font-mono tabular-nums text-[11px] text-ink-3">
            {formatElapsed(now - startedAt)}
          </span>
        }
      />
    </div>
  );
}
