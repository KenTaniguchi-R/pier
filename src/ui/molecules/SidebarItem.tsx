import type { ReactNode, MouseEvent } from "react";

interface Props {
  icon?: ReactNode;
  leading?: ReactNode;
  label: string;
  active?: boolean;
  nested?: boolean;
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
}

const BASE =
  "group relative flex items-center gap-2 w-full border border-transparent bg-transparent " +
  "rounded-[10px] cursor-pointer font-body font-medium leading-[1.2] text-left " +
  "transition-[background-color,color] duration-100 ease-(--ease-smooth)";

const TOP =
  "px-3 py-[9px] text-[13px] text-ink-2 hover:bg-surface hover:text-ink";

const TOP_ACTIVE =
  "bg-surface text-ink border-line " +
  "before:content-[''] before:absolute before:-left-[3px] before:top-2 before:bottom-2 before:w-[3px] before:rounded-[2px] before:bg-accent";

const NESTED =
  "pl-9 pr-3 py-[7px] text-[13px] text-ink-3 hover:text-ink";

const NESTED_ACTIVE = "bg-accent/10 text-ink";

export function SidebarItem({ icon, leading, label, active, nested, onClick }: Props) {
  const variant = nested
    ? `${NESTED} ${active ? NESTED_ACTIVE : ""}`
    : `${TOP} ${active ? TOP_ACTIVE : ""}`;

  return (
    <button type="button" className={`${BASE} ${variant}`} onClick={onClick}>
      {leading}
      {icon !== undefined && (
        <span
          className={`flex-none w-[18px] flex items-center justify-center ${
            nested ? "" : active ? "text-accent" : "text-ink-3"
          }`}
          aria-hidden
        >
          {icon}
        </span>
      )}
      <span className="flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
        {label}
      </span>
    </button>
  );
}
