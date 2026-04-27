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
    <SidebarItem
      label={label}
      active={active}
      onClick={onClick}
      leading={
        <span
          className="flex-none w-1.5 h-1.5 rounded-full bg-accent"
          aria-hidden
        />
      }
      trailing={
        <span className="flex-none font-mono tabular-nums text-[11px] text-ink-3">
          {formatElapsed(now - startedAt)}
        </span>
      }
    />
  );
}
