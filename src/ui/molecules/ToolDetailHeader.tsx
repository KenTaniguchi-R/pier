import { forwardRef } from "react";
import type { Tool } from "../../domain/tool";
import { useFavorites } from "../../state/FavoritesContext";
import { StarButton } from "../atoms/StarButton";

interface Props {
  tool: Tool;
  collapsed: boolean;
  onBack: () => void;
}

function eyebrowFor(tool: Tool): string {
  if (tool.category) return tool.category;
  const params = tool.parameters ?? [];
  if (params.length === 0) return "no input";
  if (params.length === 1) return `accepts ${params[0].type}`;
  return `${params.length} parameters`;
}

export const ToolDetailHeader = forwardRef<HTMLElement, Props>(function ToolDetailHeader(
  { tool, collapsed, onBack },
  ref,
) {
  const eyebrow = eyebrowFor(tool);
  const { isPinned, toggle, atCap } = useFavorites();
  const pinned = isPinned(tool.id);

  return (
    <header
      ref={ref}
      className={`flex-none px-10 border-b border-line transition-[padding,box-shadow] duration-200 ease-(--ease-smooth) ${
        collapsed ? "pt-3 pb-3 shadow-1" : "pt-5 pb-6"
      }`}
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to tools"
          className="bg-transparent border-none p-0 font-body font-medium text-[12px] leading-none text-ink-3 cursor-pointer hover:text-ink whitespace-nowrap"
        >
          ← All tools
        </button>

        {/* Inline title — visible only when collapsed. */}
        <div
          className={`flex items-center gap-2 min-w-0 transition-all duration-200 ease-(--ease-smooth) ${
            collapsed ? "opacity-100 translate-x-0 max-w-full" : "opacity-0 -translate-x-1 max-w-0 pointer-events-none"
          }`}
          aria-hidden={!collapsed}
        >
          <span className="text-ink-4 select-none">/</span>
          {tool.icon && <span className="text-[14px] leading-none">{tool.icon}</span>}
          <span className="font-display text-[15px] font-semibold tracking-[-0.01em] text-ink truncate">
            {tool.name}
          </span>
        </div>
      </div>

      {/* Expanded title block — collapses with the grid-rows trick. */}
      <div
        className={`grid transition-[grid-template-rows,opacity,margin] duration-200 ease-(--ease-smooth) ${
          collapsed ? "grid-rows-[0fr] opacity-0 mt-0" : "grid-rows-[1fr] opacity-100 mt-4"
        }`}
      >
        <div className="overflow-hidden">
          <div className="flex items-baseline gap-3 mb-2">
            {tool.icon && (
              <span className="text-[22px] leading-none translate-y-[2px]">{tool.icon}</span>
            )}
            <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink-3">
              {eyebrow}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-[34px] font-semibold tracking-[-0.02em] leading-[1.05] text-ink">
              {tool.name}
            </h1>
            <StarButton
              pinned={pinned}
              onToggle={() => toggle(tool.id)}
              disabled={!pinned && atCap}
            />
          </div>
          {tool.description && (
            <p className="mt-3 font-display italic text-[16px] leading-[1.45] text-ink-2 max-w-[58ch]">
              {tool.description}
            </p>
          )}
        </div>
      </div>
    </header>
  );
});
