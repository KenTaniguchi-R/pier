import type { CSSProperties } from "react";
import { Skeleton } from "../atoms/Skeleton";

interface Props {
  style?: CSSProperties;
}

/** Visual placeholder for `CatalogCard` — same outer shape, no interactivity. */
export function CatalogCardSkeleton({ style }: Props) {
  return (
    <div
      aria-hidden="true"
      style={style}
      className="bg-surface border border-line rounded-2 px-4 py-3.5 flex flex-col gap-2"
    >
      <Skeleton className="h-[18px] w-3/5 rounded-1" />
      <Skeleton className="h-[13px] w-full rounded-1" />
      <Skeleton className="h-[13px] w-4/5 rounded-1" />
      <Skeleton className="mt-1 h-[11px] w-16 rounded-1" />
    </div>
  );
}
