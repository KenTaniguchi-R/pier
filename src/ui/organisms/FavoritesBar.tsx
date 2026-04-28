import type { Tool } from "../../domain/tool";
import { useFavorites } from "../../state/FavoritesContext";
import { pruneMissing } from "../../domain/favorites";
import { QuickTile } from "../molecules/QuickTile";
import { StarButton } from "../atoms/StarButton";

interface Props {
  tools: Tool[];
  onPick: (id: string) => void;
  runningToolIds?: ReadonlySet<string>;
}

function StripHeader({ label, count }: { label: string; count?: string }) {
  return (
    <div className="flex items-center gap-3 mb-2">
      <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink-3">
        {label}
      </span>
      <span className="flex-1 h-px bg-line" />
      {count && (
        <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-4 tabular-nums">
          {count}
        </span>
      )}
    </div>
  );
}

export function FavoritesBar({ tools, onPick, runningToolIds }: Props) {
  const { favorites, toggle } = useFavorites();
  const toolById = new Map(tools.map((t) => [t.id, t]));
  const known = new Set(toolById.keys());
  const pinnedIds = pruneMissing(favorites, known);
  const pinnedTools = pinnedIds.map((id) => toolById.get(id)!).filter(Boolean);

  return (
    <section aria-label="Favorites" className="flex flex-col">
      <StripHeader
        label="Favorites"
        count={pinnedTools.length > 0 ? `${pinnedTools.length}/8` : undefined}
      />

      {pinnedTools.length === 0 ? (
        <div className="px-3 py-3 font-display italic text-[13px] text-ink-3">
          Star a tool to pin it here ★
        </div>
      ) : (
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {pinnedTools.map((t) => (
            <QuickTile
              key={t.id}
              tool={t}
              onClick={() => onPick(t.id)}
              running={runningToolIds?.has(t.id) ?? false}
              trailing={
                <StarButton
                  pinned
                  onToggle={() => toggle(t.id)}
                  hoverOnly
                  ariaLabel={`Unpin ${t.name}`}
                />
              }
            />
          ))}
        </div>
      )}
    </section>
  );
}
