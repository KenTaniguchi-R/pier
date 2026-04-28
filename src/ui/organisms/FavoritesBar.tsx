import type { Tool } from "../../domain/tool";
import { useFavorites } from "../../state/FavoritesContext";
import { FAVORITES_CAP, pruneMissing } from "../../domain/favorites";
import { QuickTile } from "../molecules/QuickTile";
import { StripHeader } from "../molecules/StripHeader";
import { StarButton } from "../atoms/StarButton";

interface Props {
  tools: Tool[];
  onPick: (id: string) => void;
  runningToolIds?: ReadonlySet<string>;
}

export function FavoritesBar({ tools, onPick, runningToolIds }: Props) {
  const { favorites, toggle } = useFavorites();
  const toolById = new Map(tools.map((t) => [t.id, t]));
  const pinnedTools = pruneMissing(favorites, new Set(toolById.keys()))
    .map((id) => toolById.get(id)!)
    .filter(Boolean);

  return (
    <section aria-label="Favorites" className="flex flex-col gap-2">
      <StripHeader
        label="Favorites"
        meta={pinnedTools.length > 0 ? `${pinnedTools.length}/${FAVORITES_CAP}` : undefined}
      />

      {pinnedTools.length === 0 ? (
        <div className="px-1 py-2 font-display italic text-[13px] text-ink-3">
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
