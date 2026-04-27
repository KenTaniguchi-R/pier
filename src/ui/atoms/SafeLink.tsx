import type { MouseEvent, ReactNode } from "react";
import { useOpener } from "../../state/OpenerContext";
import { isSafeUrl } from "../../domain/logSegments";

interface Props {
  url: string;
  children: ReactNode;
}

const BASE =
  "underline underline-offset-2 decoration-1 decoration-line-hi text-ink " +
  "hover:text-accent hover:decoration-accent-edge cursor-pointer " +
  "transition-colors duration-150 ease-(--ease-smooth)";

export function SafeLink({ url, children }: Props) {
  const opener = useOpener();
  const safe = isSafeUrl(url);

  if (!safe) return <span>{children}</span>;

  const handle = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    void opener.open(safe.toString());
  };

  return (
    <a
      href="#"
      role="link"
      title={safe.toString()}
      draggable={false}
      onClick={handle}
      onAuxClick={handle}
      className={BASE}
    >
      {children}
    </a>
  );
}
