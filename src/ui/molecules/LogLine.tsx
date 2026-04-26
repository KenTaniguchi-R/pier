interface Props {
  line: string;
  stream: "stdout" | "stderr";
}

export function LogLine({ line, stream }: Props) {
  const isErr = stream === "stderr";
  return (
    <div
      className={
        "flex gap-3 pl-5 pr-4 font-mono font-normal text-[12.5px] leading-[1.65] " +
        "whitespace-pre-wrap break-all animate-logline-in " +
        (isErr ? "text-danger bg-danger-soft" : "text-ink-2")
      }
    >
      <span
        aria-hidden
        className={
          "flex-none select-none translate-y-[1px] " +
          (isErr ? "text-danger" : "text-ink-4")
        }
      >
        {isErr ? "!" : "·"}
      </span>
      <span className="flex-1 min-w-0">{line}</span>
    </div>
  );
}
