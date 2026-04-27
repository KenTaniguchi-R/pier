import { describe, expect, it } from "vitest";
import {
  tokenize,
  splitByQuery,
  countMatches,
  tallyMatches,
  locateActiveMatch,
  isSafeUrl,
} from "../logSegments";

describe("tokenize", () => {
  it("returns empty for empty input", () => {
    expect(tokenize("")).toEqual([]);
  });

  it("returns single text segment when no URL present", () => {
    expect(tokenize("hello world")).toEqual([{ kind: "text", value: "hello world" }]);
  });

  it("extracts a single http URL", () => {
    const segs = tokenize("see https://example.com now");
    expect(segs).toEqual([
      { kind: "text", value: "see " },
      { kind: "url", value: "https://example.com" },
      { kind: "text", value: " now" },
    ]);
  });

  it("extracts https URL with path and query", () => {
    const segs = tokenize("https://example.com/foo?bar=1&baz=2 done");
    expect(segs[0]).toEqual({ kind: "url", value: "https://example.com/foo?bar=1&baz=2" });
  });

  it("strips trailing punctuation from URL", () => {
    expect(tokenize("see https://example.com.")).toEqual([
      { kind: "text", value: "see " },
      { kind: "url", value: "https://example.com" },
      { kind: "text", value: "." },
    ]);
    expect(tokenize("(visit https://x.io)")).toContainEqual({ kind: "url", value: "https://x.io" });
  });

  it("balances unmatched closing parens", () => {
    const segs = tokenize("(see https://en.wikipedia.org/wiki/Foo_(bar))");
    expect(segs).toContainEqual({ kind: "url", value: "https://en.wikipedia.org/wiki/Foo_(bar)" });
  });

  it("handles multiple URLs in one line", () => {
    const segs = tokenize("a https://x.com b https://y.com c");
    const urls = segs.filter((s) => s.kind === "url").map((s) => s.value);
    expect(urls).toEqual(["https://x.com", "https://y.com"]);
  });

  it("does not detect non-http schemes", () => {
    const segs = tokenize("file:///etc/passwd javascript:alert(1) ftp://x.com");
    expect(segs.every((s) => s.kind === "text")).toBe(true);
  });

  it("skips URL detection for very long lines", () => {
    const long = "https://x.com " + "a".repeat(9000);
    const segs = tokenize(long);
    expect(segs).toEqual([{ kind: "text", value: long }]);
  });
});

describe("splitByQuery", () => {
  it("returns whole text as non-match for empty query", () => {
    expect(splitByQuery("hello", "")).toEqual([{ match: false, value: "hello" }]);
  });

  it("splits case-insensitively", () => {
    expect(splitByQuery("Hello hello HELLO", "hello")).toEqual([
      { match: true, value: "Hello" },
      { match: false, value: " " },
      { match: true, value: "hello" },
      { match: false, value: " " },
      { match: true, value: "HELLO" },
    ]);
  });

  it("preserves text on no match", () => {
    expect(splitByQuery("nothing here", "xyz")).toEqual([
      { match: false, value: "nothing here" },
    ]);
  });

  it("handles match at start and end", () => {
    expect(splitByQuery("abcabc", "abc")).toEqual([
      { match: true, value: "abc" },
      { match: true, value: "abc" },
    ]);
  });
});

describe("countMatches", () => {
  it("counts non-overlapping matches case-insensitively", () => {
    expect(countMatches("Hello hello HELLO", "hello")).toBe(3);
    expect(countMatches("aaaa", "aa")).toBe(2);
    expect(countMatches("abc", "")).toBe(0);
    expect(countMatches("", "abc")).toBe(0);
  });
});

describe("tallyMatches", () => {
  it("returns empty tally for empty query", () => {
    expect(tallyMatches(["foo", "bar"], "")).toEqual({ perLine: [], total: 0 });
  });

  it("counts per line and totals", () => {
    expect(tallyMatches(["foo bar", "FOO foo", "baz"], "foo"))
      .toEqual({ perLine: [1, 2, 0], total: 3 });
  });
});

describe("locateActiveMatch", () => {
  it("places the active match in the correct line", () => {
    const perLine = [1, 2, 0, 3];
    expect(locateActiveMatch(perLine, 0)).toEqual({ lineIdx: 0, localIdx: 0 });
    expect(locateActiveMatch(perLine, 1)).toEqual({ lineIdx: 1, localIdx: 0 });
    expect(locateActiveMatch(perLine, 2)).toEqual({ lineIdx: 1, localIdx: 1 });
    expect(locateActiveMatch(perLine, 3)).toEqual({ lineIdx: 3, localIdx: 0 });
    expect(locateActiveMatch(perLine, 5)).toEqual({ lineIdx: 3, localIdx: 2 });
  });

  it("returns null when active is out of range", () => {
    expect(locateActiveMatch([1, 2], 5)).toBeNull();
    expect(locateActiveMatch([], 0)).toBeNull();
  });
});

describe("isSafeUrl", () => {
  it("accepts http and https", () => {
    expect(isSafeUrl("https://example.com")).not.toBeNull();
    expect(isSafeUrl("http://example.com")).not.toBeNull();
  });

  it("rejects dangerous schemes", () => {
    expect(isSafeUrl("javascript:alert(1)")).toBeNull();
    expect(isSafeUrl("data:text/html,<script>1</script>")).toBeNull();
    expect(isSafeUrl("file:///etc/passwd")).toBeNull();
    expect(isSafeUrl("vbscript:msgbox(1)")).toBeNull();
    expect(isSafeUrl("blob:https://x.com/abc")).toBeNull();
    expect(isSafeUrl("ftp://x.com")).toBeNull();
  });

  it("rejects URLs with userinfo (confused deputy via auth segment)", () => {
    expect(isSafeUrl("https://github.com@evil.com/")).toBeNull();
    expect(isSafeUrl("https://user:pass@evil.com/")).toBeNull();
  });

  it("rejects malformed URLs", () => {
    expect(isSafeUrl("not a url")).toBeNull();
    expect(isSafeUrl("")).toBeNull();
    expect(isSafeUrl("https://")).toBeNull();
  });

  it("rejects very long URLs", () => {
    expect(isSafeUrl("https://x.com/" + "a".repeat(5000))).toBeNull();
  });

  it("rejects URLs containing bidi or zero-width chars", () => {
    expect(isSafeUrl("https://example.com/‮evil")).toBeNull();
    expect(isSafeUrl("https://exa​mple.com/")).toBeNull();
  });
});
