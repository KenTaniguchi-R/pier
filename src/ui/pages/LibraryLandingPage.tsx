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
  const reference = now ?? new Date();

  const featured = useMemo(() => tools.filter((t) => t.featured), [tools]);
  const fresh = useMemo(
    () => tools.filter((t) => isWithinDays(t.addedAt, reference, 7)),
    [tools, reference],
  );
  const developer = useMemo(
    () => tools.filter((t) => t.audience?.includes("developer")),
    [tools],
  );
  const popular = useMemo(() => {
    const shown = new Set<string>();
    for (const t of featured) shown.add(t.id);
    for (const t of fresh) shown.add(t.id);
    for (const t of developer) shown.add(t.id);
    return tools.filter((t) => !shown.has(t.id));
  }, [tools, featured, fresh, developer]);

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

      <CatalogRow
        title="Featured"
        tools={featured}
        installedIds={installedIds}
        onSelectTool={onSelectTool}
        onSeeAll={onSeeAll}
      />
      <CatalogRow
        title="New this week"
        tools={fresh}
        installedIds={installedIds}
        onSelectTool={onSelectTool}
        onSeeAll={onSeeAll}
      />
      <CatalogRow
        title="For developers"
        tools={developer}
        installedIds={installedIds}
        onSelectTool={onSelectTool}
        onSeeAll={onSeeAll}
      />
      <CatalogRow
        title="Popular"
        tools={popular}
        installedIds={installedIds}
        onSelectTool={onSelectTool}
        onSeeAll={onSeeAll}
      />
    </div>
  );
}
