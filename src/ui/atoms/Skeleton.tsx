import type { HTMLAttributes } from "react";

const BASE = "block bg-bg-2 rounded-2 animate-pulse-soft";

/** Static placeholder shape used by skeleton screens. Size with `className`. */
export function Skeleton({
  className = "",
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden="true" className={`${BASE} ${className}`} {...rest} />;
}
