import type { CSSProperties } from "react";
import { Check } from "lucide-react";
import type { CatalogTool } from "../../domain/library";

interface Props {
  tool: CatalogTool;
  installed: boolean;
  onSelect: (t: CatalogTool) => void;
  style?: CSSProperties;
}

export function CatalogCard({ tool, installed, onSelect, style }: Props) {
  const outcome = tool.outcome ?? tool.description;
  const audienceTag =
    tool.audience && tool.audience.length > 0 ? tool.audience[0] : null;

  return (
    <button
      type="button"
      onClick={() => onSelect(tool)}
      style={style}
      className={`
        relative group text-left
        bg-surface border border-line rounded-2 px-4 py-3.5
        flex flex-col gap-1.5
        transition-[border-color,box-shadow,transform] duration-150 ease-(--ease-smooth)
        hover:border-line-hi hover:shadow-2
        focus:outline-none focus:border-accent-edge focus:shadow-[0_0_0_4px_var(--color-accent-soft)]
        animate-tile-in
        ${installed ? "opacity-70" : ""}
      `}
    >
      {installed && (
        <span
          aria-label="Already added"
          className="absolute top-2 right-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-accent text-white"
        >
          <Check size={12} aria-hidden />
        </span>
      )}
      <span className="font-display text-[17px] leading-tight text-ink truncate">
        {tool.name}
      </span>
      <p className="text-[13px] leading-snug text-ink-3 line-clamp-2">
        {outcome}
      </p>
      {audienceTag && (
        <div className="mt-1 flex items-center gap-2 text-[11px] text-ink-4">
          <span className="font-mono uppercase tracking-wider">{audienceTag}</span>
        </div>
      )}
    </button>
  );
}
