import { describe, it, expect } from "vitest";
import { summarizeAdvanced } from "../summarizeAdvanced";
import type { Parameter, ParamValue } from "../../domain/tool";

const sel = (id: string, label: string, options: string[], advanced = true): Parameter =>
  ({ id, label, type: "select", options, advanced });
const bool = (id: string, label: string, advanced = true): Parameter =>
  ({ id, label, type: "boolean", advanced });
const text = (id: string, label: string, advanced = true): Parameter =>
  ({ id, label, type: "text", advanced });
const file = (id: string, label: string, advanced = true): Parameter =>
  ({ id, label, type: "file", advanced });

describe("summarizeAdvanced", () => {
  it("renders booleans as on/off", () => {
    const params = [bool("clean", "Clean audio")];
    const values: Record<string, ParamValue> = { clean: false };
    expect(summarizeAdvanced(params, values))
      .toBe("Advanced options · Clean audio: off");
  });

  it("renders selects as the chosen value", () => {
    const params = [sel("voice", "Voice model", ["mlx_qwen3", "tts_other"])];
    expect(summarizeAdvanced(params, { voice: "mlx_qwen3" }))
      .toBe("Advanced options · Voice model: mlx_qwen3");
  });

  it("joins multiple fields with ' · '", () => {
    const params = [
      sel("voice", "Voice model", ["mlx_qwen3"]),
      bool("clean", "Clean audio"),
    ];
    expect(summarizeAdvanced(params, { voice: "mlx_qwen3", clean: false }))
      .toBe("Advanced options · Voice model: mlx_qwen3 · Clean audio: off");
  });

  it("uses '—' for unset / empty values", () => {
    const params = [text("title", "Title")];
    expect(summarizeAdvanced(params, {}))
      .toBe("Advanced options · Title: —");
    expect(summarizeAdvanced(params, { title: "" }))
      .toBe("Advanced options · Title: —");
  });

  it("renders file values as basename only", () => {
    const params = [file("input", "Input")];
    expect(summarizeAdvanced(params, { input: "/Users/me/movies/x.mp4" }))
      .toBe("Advanced options · Input: x.mp4");
  });

  it("truncates long text values to 20 chars with ellipsis", () => {
    const params = [text("note", "Note")];
    expect(summarizeAdvanced(params, { note: "a".repeat(40) }))
      .toBe(`Advanced options · Note: ${"a".repeat(20)}…`);
  });

  it("when total exceeds 80 chars, trims at a · boundary and appends '+N more'", () => {
    const params = [
      text("a", "Alpha alpha alpha"),
      text("b", "Bravo bravo bravo"),
      text("c", "Charlie charlie"),
      text("d", "Delta delta delta"),
      text("e", "Echo echo echo"),
    ];
    const values = {
      a: "value-aaaa", b: "value-bbbb", c: "value-cccc",
      d: "value-dddd", e: "value-eeee",
    };
    const out = summarizeAdvanced(params, values);
    expect(out.length).toBeLessThanOrEqual(80 + " · +N more".length + 2);
    expect(out).toMatch(/\+\d+ more$/);
    expect(out.startsWith("Advanced options · ")).toBe(true);
  });

  it("returns just the prefix when given no params", () => {
    expect(summarizeAdvanced([], {})).toBe("Advanced options");
  });
});
