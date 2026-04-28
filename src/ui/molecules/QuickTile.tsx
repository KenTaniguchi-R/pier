import type { ReactNode } from "react";
import type { Tool } from "../../domain/tool";

interface Props {
  tool: Tool;
  onClick: () => void;
  /** Rendered as a sibling of the click button so it can itself be interactive
   *  without nesting `<button>` inside `<button>`. */
  trailing?: ReactNode;
  subtitle?: ReactNode;
  running?: boolean;
}

export function QuickTile({ tool, onClick, trailing, subtitle, running = false }: Props) {
  return (
    <div className="group relative flex-none w-[200px] animate-tile-in">
      <button
        type="button"
        onClick={onClick}
        title={tool.name}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 bg-surface border border-line rounded-[10px] text-left cursor-pointer transition-[border-color,box-shadow,transform] duration-150 ease-(--ease-smooth) hover:border-line-hi hover:shadow-1 hover:-translate-y-px"
      >
        <span
          className="relative flex-none w-7 h-7 flex items-center justify-center bg-bg-2 rounded-[8px] text-[16px] text-ink leading-none"
          aria-hidden
        >
          {tool.icon ?? "▸"}
          {running && (
            <span
              className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-accent ring-2 ring-surface animate-run-pulse"
              aria-label="Running"
            />
          )}
        </span>

        <span className="flex flex-col min-w-0 flex-1 gap-0.5 pr-4">
          <span className="font-display text-[13px] font-semibold text-ink tracking-[-0.005em] leading-[1.2] truncate">
            {tool.name}
          </span>
          {subtitle && (
            <span className="font-mono text-[10.5px] text-ink-3 leading-none truncate">
              {subtitle}
            </span>
          )}
        </span>
      </button>

      {trailing && (
        <span className="absolute top-1/2 right-2 -translate-y-1/2 flex items-center z-10 pointer-events-none [&>*]:pointer-events-auto">
          {trailing}
        </span>
      )}
    </div>
  );
}
