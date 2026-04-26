interface Props {
  ts: number;
  line: string;
  stream: "stdout" | "stderr";
  lineNumber?: number;
}

export function LogLine({ line, stream, lineNumber }: Props) {
  return (
    <div
      className={
        "flex gap-2 px-3 font-mono font-normal text-[12.5px] leading-[1.6] whitespace-pre-wrap break-words animate-logline-in " +
        (stream === "stderr" ? "text-danger" : "text-ink-2")
      }
    >
      {typeof lineNumber === "number" && (
        <span className="flex-none w-8 text-right text-ink-4 select-none pr-2">{lineNumber}</span>
      )}
      <span className="flex-1">{line}</span>
    </div>
  );
}
