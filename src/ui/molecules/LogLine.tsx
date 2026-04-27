import { memo, useMemo } from "react";
import type { ReactNode } from "react";
import type { Stream } from "../../domain/runRequest";
import { tokenize, splitByQuery } from "../../domain/logSegments";
import { SafeLink } from "../atoms/SafeLink";

interface Props {
  line: string;
  stream: Stream;
  query?: string;
  /** 0-based index of the active match within this line, if any. */
  activeMatchInLine?: number;
}

const LINE_BASE =
  "flex gap-3 pl-5 pr-4 font-mono font-normal text-[12.5px] leading-[1.65] " +
  "whitespace-pre-wrap break-all animate-logline-in";

const MARK_BASE = "rounded-[2px] px-[1px]";

function markClass(isErr: boolean, isActive: boolean): string {
  if (isErr) {
    return isActive
      ? `${MARK_BASE} bg-ink/20 outline outline-1 outline-ink-2`
      : `${MARK_BASE} bg-ink/10`;
  }
  return isActive
    ? `${MARK_BASE} bg-warning/35 outline outline-1 outline-warning`
    : `${MARK_BASE} bg-warning-soft`;
}

/** Render `text` with substring matches wrapped in `<mark>`. `nextLocal` tracks
 *  the next match's 0-based index within the enclosing line. */
function renderHighlighted(
  text: string,
  query: string,
  isErr: boolean,
  activeMatchInLine: number | undefined,
  nextLocal: { value: number },
): ReactNode[] {
  if (!query) return [text];
  return splitByQuery(text, query).map((p, i) => {
    if (!p.match) return p.value;
    const isActive = activeMatchInLine === nextLocal.value;
    nextLocal.value++;
    return (
      <mark
        key={i}
        data-pier-match={isActive ? "active" : "match"}
        className={markClass(isErr, isActive)}
      >
        {p.value}
      </mark>
    );
  });
}

function LogLineImpl({ line, stream, query = "", activeMatchInLine }: Props) {
  const isErr = stream === "stderr";
  const segments = useMemo(() => tokenize(line), [line]);
  const cursor = { value: 0 };

  return (
    <div className={`${LINE_BASE} ${isErr ? "text-danger bg-danger-soft" : "text-ink-2"}`}>
      <span
        aria-hidden
        className={`flex-none select-none translate-y-[1px] ${isErr ? "text-danger" : "text-ink-4"}`}
      >
        {isErr ? "!" : "·"}
      </span>
      <span className="flex-1 min-w-0">
        {segments.map((seg, i) => {
          const nodes = renderHighlighted(seg.value, query, isErr, activeMatchInLine, cursor);
          return seg.kind === "url" ? (
            <SafeLink key={i} url={seg.value}>{nodes}</SafeLink>
          ) : (
            <span key={i}>{nodes}</span>
          );
        })}
      </span>
    </div>
  );
}

export const LogLine = memo(LogLineImpl);
