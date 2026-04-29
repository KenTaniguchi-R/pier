import type { Tool } from "../../domain/tool";
import { FavoritesBar } from "./FavoritesBar";
import { RecentRunsStrip } from "./RecentRunsStrip";
import { ToolBrowser } from "./ToolBrowser";

interface Props {
  tools: Tool[];
  filteredTools: Tool[];
  /** Whether the Favorites + Recent strips should render. False on
   *  search/category views so intent-focused screens stay clean. */
  showStrips: boolean;
  browserTitle: string;
  browserSub?: string;
  onPick: (id: string) => void;
  runningToolIds?: ReadonlySet<string>;
  emptyHint: string;
}

/** Composes the strips + tool grid for the Home/All-tools view. */
export function HomeAllTools({
  tools,
  filteredTools,
  showStrips,
  browserTitle,
  browserSub,
  onPick,
  runningToolIds,
  emptyHint,
}: Props) {
  return (
    <div className="flex flex-col">
      {showStrips && (
        <div className="px-8 pt-6 flex flex-col gap-5">
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
