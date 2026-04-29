import type { CatalogTool } from "../../domain/library";
import { CatalogCard } from "../molecules/CatalogCard";

interface Props {
  title: string;
  tools: CatalogTool[];
  installedIds: Set<string>;
  onSelectTool: (t: CatalogTool) => void;
  onSeeAll?: () => void;
}

export function CatalogRow({ title, tools, installedIds, onSelectTool, onSeeAll }: Props) {
  if (tools.length === 0) return null;
  return (
    <section className="flex flex-col gap-3">
      <header className="flex items-baseline justify-between">
        <h2 className="font-display text-xl text-ink">{title}</h2>
        {onSeeAll && (
          <button
            type="button"
            onClick={onSeeAll}
            className="text-[13px] text-ink-3 hover:text-ink"
          >
            See all →
          </button>
        )}
      </header>
      <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1 snap-x">
        {tools.map((t) => (
          <div key={t.id} className="snap-start shrink-0 w-[280px]">
            <CatalogCard
              tool={t}
              installed={installedIds.has(t.id)}
              onSelect={onSelectTool}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
