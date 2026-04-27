import { useEffect, useState } from "react";

/** Live-elapsed format used in run rows: `m:ss` under an hour, `Hh MMm` over. */
export function formatElapsed(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2, "0")}m`;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

/** Finalised duration format used in run headers and history rows. */
export function formatDuration(ms: number): string {
  if (ms < 1000) return "<1s";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rs = s % 60;
  if (m < 60) return rs ? `${m}m ${rs}s` : `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

/** Coarse "time ago" relative to now. */
export function relativeTime(ms: number): string {
  const d = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (d < 45) return "just now";
  if (d < 60) return `${d}s ago`;
  if (d < 3600) {
    const m = Math.floor(d / 60);
    return `${m} ${m === 1 ? "minute" : "minutes"} ago`;
  }
  if (d < 86400) {
    const h = Math.floor(d / 3600);
    return `${h} ${h === 1 ? "hour" : "hours"} ago`;
  }
  const days = Math.floor(d / 86400);
  return `${days} ${days === 1 ? "day" : "days"} ago`;
}

/** Re-renders every `intervalMs` while `enabled` is true. Returns Date.now(). */
export function useNow(enabled: boolean, intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [enabled, intervalMs]);
  return now;
}
