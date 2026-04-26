interface Props {
  ts: number;
  line: string;
  stream: "stdout" | "stderr";
  lineNumber?: number;
}

export function LogLine({ line, stream, lineNumber }: Props) {
  return (
    <div className={`log-line${stream === "stderr" ? " log-line--stderr" : ""}`}>
      {typeof lineNumber === "number" && (
        <span className="log-line__num">{lineNumber}</span>
      )}
      <span className="log-line__text">{line}</span>
    </div>
  );
}
