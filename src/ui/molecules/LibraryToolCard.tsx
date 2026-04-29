import type { CSSProperties } from "react";
import type { CatalogTool } from "../../domain/library";

interface Props {
  tool: CatalogTool;
  onSelect: (t: CatalogTool) => void;
  style?: CSSProperties;
}

export function LibraryToolCard({ tool, onSelect, style }: Props) {
  return (
    <button
      type="button"
      onClick={() => onSelect(tool)}
      style={style}
      className="
        group text-left
        bg-surface border border-line rounded-2 px-4 py-3.5
        flex flex-col gap-1.5
        transition-[border-color,box-shadow,transform] duration-150 ease-(--ease-smooth)
        hover:border-line-hi hover:shadow-2
        focus:outline-none focus:border-accent-edge focus:shadow-[0_0_0_4px_var(--color-accent-soft)]
        animate-tile-in
      "
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-display text-[17px] leading-tight text-ink">
          {tool.name}
        </span>
        {tool.tier === "advanced" && (
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-3 border border-line rounded-1 px-1.5 py-px">
            ADV
          </span>
        )}
      </div>
      <p className="text-[13px] leading-snug text-ink-3 line-clamp-2">
        {tool.description}
      </p>
      <div className="mt-1 flex items-center gap-2 text-[11px] text-ink-4">
        <span className="font-mono">v{tool.version}</span>
        <span aria-hidden>·</span>
        <span className="font-mono uppercase tracking-wider">{tool.category}</span>
      </div>
    </button>
  );
}
