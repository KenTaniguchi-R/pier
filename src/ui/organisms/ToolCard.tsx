import type { Tool } from "../../domain/tool";
import { useFavorites } from "../../state/FavoritesContext";
import { StarButton } from "../atoms/StarButton";

export function ToolCard({
  tool,
  onClick,
  running = false,
}: {
  tool: Tool;
  onClick: () => void;
  running?: boolean;
}) {
  const { isPinned, toggle, atCap } = useFavorites();
  const pinned = isPinned(tool.id);

  return (
    <div className="group relative">
      <button
        type="button"
        onClick={onClick}
        className="w-full relative flex items-start gap-3 px-4 py-3 bg-surface border border-line rounded-[14px] cursor-pointer text-left shadow-1 min-h-[92px] overflow-hidden transition-[border-color,box-shadow,transform] duration-200 ease-(--ease-smooth) hover:border-line-hi hover:shadow-2 hover:-translate-y-px active:translate-y-0 active:shadow-1"
      >
        <span
          className="relative flex-none w-14 h-14 flex items-center justify-center bg-bg-2 rounded-[10px] text-[24px] text-ink"
          aria-hidden
        >
          {tool.icon ?? "▸"}
          {running && (
            <span
              className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-accent ring-2 ring-surface animate-run-pulse"
              aria-label="Running"
            />
          )}
        </span>

        <span className="flex flex-col gap-1 min-w-0 flex-1 pr-6">
          <span className="font-display text-[15px] font-semibold text-ink tracking-[-0.005em] leading-[1.25]">
            {tool.name}
          </span>
          {tool.description && (
            <span className="text-[12.5px] text-ink-3 leading-[1.45] overflow-hidden line-clamp-2">
              {tool.description}
            </span>
          )}
        </span>
      </button>

      <span className="absolute top-2 right-2 z-10">
        <StarButton
          pinned={pinned}
          onToggle={() => toggle(tool.id)}
          hoverOnly
          disabled={!pinned && atCap}
        />
      </span>
    </div>
  );
}
