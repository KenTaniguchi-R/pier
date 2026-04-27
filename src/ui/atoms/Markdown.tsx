import type { ReactNode } from "react";
import { SafeLink } from "./SafeLink";

interface Props { source: string }

export function Markdown({ source }: Props) {
  return <div className="font-body text-[13px] leading-[1.6] text-ink-2">{renderBlocks(source)}</div>;
}

function renderBlocks(src: string): ReactNode[] {
  const lines = src.replace(/\r\n/g, "\n").split("\n");
  const nodes: ReactNode[] = [];
  let i = 0;
  let key = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === "") { i++; continue; }
    if (/^```/.test(line)) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) { buf.push(lines[i]); i++; }
      i++;
      nodes.push(
        <pre key={key++} className="my-3 px-3 py-2 bg-bg-2 border border-line rounded-[10px] font-mono text-[12px] leading-[1.5] text-ink-2 whitespace-pre-wrap break-all">{buf.join("\n")}</pre>,
      );
      continue;
    }
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) {
      const level = h[1].length;
      const Tag = (`h${level}` as "h1" | "h2" | "h3");
      const cls = level === 1
        ? "font-display text-[20px] font-semibold text-ink mt-4 mb-2"
        : level === 2
        ? "font-display text-[16px] font-semibold text-ink mt-4 mb-2"
        : "font-display text-[14px] font-semibold text-ink mt-3 mb-1";
      nodes.push(<Tag key={key++} className={cls}>{renderInline(h[2], () => key++)}</Tag>);
      i++;
      continue;
    }
    if (/^(\s*[-*]\s+|\s*\d+\.\s+)/.test(line)) {
      const ordered = /^\s*\d+\.\s+/.test(line);
      const items: string[] = [];
      while (i < lines.length && /^(\s*[-*]\s+|\s*\d+\.\s+)/.test(lines[i])) {
        items.push(lines[i].replace(/^(\s*[-*]\s+|\s*\d+\.\s+)/, ""));
        i++;
      }
      const ListTag = ordered ? "ol" : "ul";
      const cls = ordered ? "list-decimal pl-5 my-2 space-y-1" : "list-disc pl-5 my-2 space-y-1";
      nodes.push(
        <ListTag key={key++} className={cls}>
          {items.map((it, idx) => <li key={idx}>{renderInline(it, () => key++)}</li>)}
        </ListTag>,
      );
      continue;
    }
    const paraLines: string[] = [];
    while (i < lines.length && lines[i].trim() !== "" && !/^(```|#|\s*[-*]\s|\s*\d+\.\s)/.test(lines[i])) {
      paraLines.push(lines[i]); i++;
    }
    if (paraLines.length > 0) {
      nodes.push(<p key={key++} className="my-2">{renderInline(paraLines.join(" "), () => key++)}</p>);
    }
  }
  return nodes;
}

function renderInline(src: string, nextKey: () => number): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\[([^\]]+)\]\(([^)]+)\))|(`([^`]+)`)|(\*\*([^*]+)\*\*)|(\*([^*]+)\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    if (m.index > last) out.push(src.slice(last, m.index));
    if (m[1]) {
      out.push(<SafeLink key={nextKey()} url={m[3]}>{m[2]}</SafeLink>);
    } else if (m[4]) {
      out.push(<code key={nextKey()} className="font-mono text-[12px] bg-bg-2 border border-line rounded-[6px] px-1 py-px">{m[5]}</code>);
    } else if (m[6]) {
      out.push(<strong key={nextKey()} className="font-semibold text-ink">{m[7]}</strong>);
    } else if (m[8]) {
      out.push(<em key={nextKey()} className="italic">{m[9]}</em>);
    }
    last = m.index + m[0].length;
  }
  if (last < src.length) out.push(src.slice(last));
  return out;
}
