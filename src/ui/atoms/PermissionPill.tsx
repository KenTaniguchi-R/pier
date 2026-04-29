type Kind = "network" | "fsRead" | "fsWrite";

const LABEL: Record<Kind, string> = {
  network: "Internet",
  fsRead: "Reads",
  fsWrite: "Writes",
};

const BASE =
  "inline-flex items-center gap-1.5 px-2 py-[3px] rounded-pill border " +
  "text-[10.5px] leading-none whitespace-nowrap";

const KIND_STYLES: Record<Kind, string> = {
  network: "bg-accent-soft border-accent-edge text-accent",
  fsRead: "bg-transparent border-line text-ink-2",
  fsWrite: "bg-transparent border-line text-ink-2",
};

export function PermissionPill({ kind, path }: { kind: Kind; path?: string }) {
  return (
    <span className={`${BASE} ${KIND_STYLES[kind]}`}>
      <span className="font-mono uppercase tracking-wider">{LABEL[kind]}</span>
      {path && <span className="font-mono lowercase tracking-normal">{path}</span>}
    </span>
  );
}
