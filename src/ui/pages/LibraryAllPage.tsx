import { useMemo, useState } from "react";
import type { CatalogTool } from "../../domain/library";
import { CatalogCard } from "../molecules/CatalogCard";
import { TextField } from "../atoms/TextField";

interface Props {
  tools: CatalogTool[];
  installedIds: Set<string>;
  onSelectTool: (t: CatalogTool) => void;
  onBack: () => void;
}

export function LibraryAllPage({ tools, installedIds, onSelectTool, onBack }: Props) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const t of tools) set.add(t.category);
    return [...set].sort();
  }, [tools]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tools.filter((t) => {
      if (category !== null && t.category !== category) return false;
      if (q === "") return true;
      const hay = [
        t.name.toLowerCase(),
        (t.outcome ?? "").toLowerCase(),
        t.description.toLowerCase(),
        t.category.toLowerCase(),
      ];
      return hay.some((s) => s.includes(q));
    });
  }, [tools, query, category]);

  return (
    <div className="flex flex-col gap-5 px-8 py-6">
      <header className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="text-[13px] text-ink-3 hover:text-ink"
        >
          ← Back
        </button>
        <h1 className="font-display text-2xl text-ink">All tools</h1>
      </header>

      <TextField
        variant="compact"
        placeholder="Search the library…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <div className="flex flex-wrap gap-2">
        <CategoryChip
          label="All"
          active={category === null}
          onClick={() => setCategory(null)}
        />
        {categories.map((c) => (
          <CategoryChip
            key={c}
            label={c}
            active={category === c}
            onClick={() => setCategory(c)}
          />
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="font-display italic text-ink-3">No tools match.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {visible.map((t, i) => (
            <CatalogCard
              key={t.id}
              tool={t}
              installed={installedIds.has(t.id)}
              onSelect={onSelectTool}
              style={{ animationDelay: `${i * 30}ms` }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CategoryChip({
  label, active, onClick,
}: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        px-3 py-1 rounded-full text-[12px] font-mono border
        ${active
          ? "bg-accent text-white border-accent"
          : "bg-bg-2 text-ink-2 border-line hover:border-line-hi"}
      `}
    >
      {label}
    </button>
  );
}
