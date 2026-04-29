import { useMemo } from "react";
import type { CatalogTool } from "../../domain/library";
import { CatalogRow } from "../organisms/CatalogRow";

interface Props {
  tools: CatalogTool[];
  installedIds: Set<string>;
  /** Injected for tests — defaults to new Date() */
  now?: Date;
  onSelectTool: (t: CatalogTool) => void;
  onSeeAll: () => void;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function isWithinDays(addedAt: string | undefined, now: Date, days: number): boolean {
  if (!addedAt) return false;
  const t = Date.parse(addedAt);
  if (Number.isNaN(t)) return false;
  return now.getTime() - t <= days * MS_PER_DAY;
}

export function LibraryLandingPage({ tools, installedIds, now, onSelectTool, onSeeAll }: Props) {
  // Stabilize the default `new Date()` so dependent memos don't churn each render.
  const reference = useMemo(() => now ?? new Date(), [now]);

  const rows = useMemo(() => {
    const featured = tools.filter((t) => t.featured);
    const fresh = tools.filter((t) => isWithinDays(t.addedAt, reference, 7));
    const developer = tools.filter((t) => t.audience?.includes("developer"));
    const shown = new Set<string>();
    for (const t of [...featured, ...fresh, ...developer]) shown.add(t.id);
    const popular = tools.filter((t) => !shown.has(t.id));
    return [
      { title: "Featured", tools: featured },
      { title: "New this week", tools: fresh },
      { title: "For developers", tools: developer },
      { title: "Popular", tools: popular },
    ];
  }, [tools, reference]);

  return (
    <div className="flex flex-col gap-8 px-8 py-6">
      <header>
        <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink-3 mb-1.5">
          Library
        </div>
        <h1 className="font-display text-3xl leading-tight text-ink">Browse tools</h1>
        <p className="mt-1.5 text-[14px] text-ink-3">
          Curated, signed tools from the <span className="font-mono">pier-tools</span> catalog.
        </p>
      </header>

      {rows.map((row) => (
        <CatalogRow
          key={row.title}
          title={row.title}
          tools={row.tools}
          installedIds={installedIds}
          onSelectTool={onSelectTool}
          onSeeAll={onSeeAll}
        />
      ))}
    </div>
  );
}
