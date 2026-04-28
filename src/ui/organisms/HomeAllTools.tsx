import type { Tool } from "../../domain/tool";
import { FavoritesBar } from "./FavoritesBar";
import { RecentRunsStrip } from "./RecentRunsStrip";
import { ToolBrowser } from "./ToolBrowser";

interface Props {
  tools: Tool[];
  filteredTools: Tool[];
  query: string;
  isAllSelection: boolean;
  browserTitle: string;
  browserSub?: string;
  onPick: (id: string) => void;
  runningToolIds?: ReadonlySet<string>;
  emptyHint?: string;
}

export function HomeAllTools({
  tools,
  filteredTools,
  query,
  isAllSelection,
  browserTitle,
  browserSub,
  onPick,
  runningToolIds,
  emptyHint,
}: Props) {
  const showStrips = isAllSelection && query.trim() === "";

  return (
    <div className="flex flex-col">
      {showStrips && (
        <div className="px-8 pt-6 pb-0 flex flex-col gap-5">
          <FavoritesBar tools={tools} onPick={onPick} runningToolIds={runningToolIds} />
          <RecentRunsStrip tools={tools} onPick={onPick} runningToolIds={runningToolIds} />
        </div>
      )}

      <ToolBrowser
        title={browserTitle}
        subtitle={browserSub}
        tools={filteredTools}
        onPick={onPick}
        runningToolIds={runningToolIds}
        emptyHint={emptyHint}
      />
    </div>
  );
}
