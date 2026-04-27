/** Pure log-segment + URL parsing utilities. No React, no Tauri. */

export type Segment =
  | { kind: "text"; value: string }
  | { kind: "url"; value: string };

const LINKIFY_LINE_CAP = 8192;
const TRAILING_PUNCT = /[.,;:!?\]}>"'`]+$/;
const URL_REGEX = /\bhttps?:\/\/[^\s<>"'`\\]+/gi;

/** Bidi controls + zero-width / BOM chars that confuse displayed URLs. */
const STRIP_INVISIBLE =
  /[‪-‮⁦-⁩​-‍﻿]/g;

export function tokenize(line: string): Segment[] {
  if (line.length === 0) return [];
  if (line.length > LINKIFY_LINE_CAP) return [{ kind: "text", value: line }];

  const out: Segment[] = [];
  let cursor = 0;
  URL_REGEX.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = URL_REGEX.exec(line)) !== null) {
    let raw = m[0];
    const start = m.index;

    let trimmed = raw.replace(TRAILING_PUNCT, "");
    const opens = (trimmed.match(/\(/g) || []).length;
    const closes = (trimmed.match(/\)/g) || []).length;
    if (closes > opens) {
      const drop = closes - opens;
      trimmed = trimmed.replace(/\)+$/, (s) => s.slice(0, Math.max(0, s.length - drop)));
    }
    if (trimmed.length === 0) continue;
    const end = start + trimmed.length;

    if (start > cursor) out.push({ kind: "text", value: line.slice(cursor, start) });
    const displayUrl = trimmed.replace(STRIP_INVISIBLE, "");
    out.push({ kind: "url", value: displayUrl });
    cursor = end;
    URL_REGEX.lastIndex = end;
  }
  if (cursor < line.length) out.push({ kind: "text", value: line.slice(cursor) });
  return out;
}

export interface QueryPiece {
  match: boolean;
  value: string;
}

export function splitByQuery(text: string, query: string): QueryPiece[] {
  if (!query) return [{ match: false, value: text }];
  const hay = text.toLocaleLowerCase();
  const needle = query.toLocaleLowerCase();
  if (needle.length === 0) return [{ match: false, value: text }];

  const pieces: QueryPiece[] = [];
  let i = 0;
  while (i < text.length) {
    const found = hay.indexOf(needle, i);
    if (found === -1) {
      if (i < text.length) pieces.push({ match: false, value: text.slice(i) });
      break;
    }
    if (found > i) pieces.push({ match: false, value: text.slice(i, found) });
    pieces.push({ match: true, value: text.slice(found, found + needle.length) });
    i = found + needle.length;
  }
  return pieces;
}

export function countMatches(text: string, query: string): number {
  if (!query) return 0;
  const hay = text.toLocaleLowerCase();
  const needle = query.toLocaleLowerCase();
  if (needle.length === 0) return 0;
  let count = 0;
  let i = 0;
  while ((i = hay.indexOf(needle, i)) !== -1) {
    count++;
    i += needle.length;
  }
  return count;
}

export interface MatchTally {
  /** Match count per line, parallel to the input array. */
  perLine: number[];
  /** Sum of perLine. */
  total: number;
}

export function tallyMatches(lines: readonly string[], query: string): MatchTally {
  if (!query) return { perLine: [], total: 0 };
  const perLine: number[] = new Array(lines.length);
  let total = 0;
  for (let i = 0; i < lines.length; i++) {
    const c = countMatches(lines[i], query);
    perLine[i] = c;
    total += c;
  }
  return { perLine, total };
}

export interface ActiveMatchLocation {
  /** Line index containing the active match. */
  lineIdx: number;
  /** Match index within that line (0-based). */
  localIdx: number;
}

/** Locate which line the global `active` match falls within. */
export function locateActiveMatch(perLine: readonly number[], active: number): ActiveMatchLocation | null {
  let acc = 0;
  for (let i = 0; i < perLine.length; i++) {
    const next = acc + perLine[i];
    if (next > active) return { lineIdx: i, localIdx: active - acc };
    acc = next;
  }
  return null;
}

const ALLOWED_SCHEMES = new Set(["http:", "https:"]);

export function isSafeUrl(raw: string): URL | null {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 4096) return null;
  STRIP_INVISIBLE.lastIndex = 0;
  if (STRIP_INVISIBLE.test(raw)) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (!ALLOWED_SCHEMES.has(url.protocol)) return null;
  if (url.username || url.password) return null;
  if (!url.hostname) return null;
  return url;
}
