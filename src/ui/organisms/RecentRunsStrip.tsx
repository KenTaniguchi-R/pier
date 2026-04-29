import type { Tool } from "../../domain/tool";
import { useRecentTools } from "../../state/useRecentTools";
import { QuickTile } from "../molecules/QuickTile";
import { StripHeader } from "../molecules/StripHeader";
import { StatusDot } from "../atoms/StatusDot";
import { relativeTime, useNow } from "../molecules/elapsed";

interface Props {
  tools: Tool[];
  onPick: (id: string) => void;
  runningToolIds?: ReadonlySet<string>;
  limit?: number;
}

export function RecentRunsStrip({ tools, onPick, runningToolIds, limit = 6 }: Props) {
  const { tools: recent, loading } = useRecentTools(limit);
  const toolById = new Map(tools.map((t) => [t.id, t]));
  const items = recent
    .map((r) => ({ run: r, tool: toolById.get(r.toolId) }))
    .filter((x): x is { run: typeof x.run; tool: Tool } => !!x.tool);

  // Tick once a minute so "2m ago" stays fresh; idle when nothing recent.
  useNow(items.length > 0, 60_000);

  if (loading || items.length === 0) return null;

  return (
    <section aria-label="Recent runs" className="flex flex-col gap-2">
      <StripHeader label="Recent" />

      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map(({ run, tool }) => (
          <QuickTile
            key={tool.id}
            tool={tool}
            onClick={() => onPick(tool.id)}
            running={runningToolIds?.has(tool.id) ?? false}
            subtitle={relativeTime(run.lastRunAt)}
            trailing={<StatusDot status={run.lastStatus} />}
          />
        ))}
      </div>
    </section>
  );
}
