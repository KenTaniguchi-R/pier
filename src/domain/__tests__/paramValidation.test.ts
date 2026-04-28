import { describe, it, expect } from "vitest";
import { validateParam, validateValues, errorMessage } from "../paramValidation";
import type { Parameter } from "../tool";

describe("validateParam", () => {
  it("flags required when empty string", () => {
    const p: Parameter = { id: "x", label: "X", type: "text" };
    expect(validateParam(p, "")).toEqual({ kind: "required" });
  });

  it("ignores required when optional", () => {
    const p: Parameter = { id: "x", label: "X", type: "text", optional: true };
    expect(validateParam(p, "")).toBeNull();
  });

  it("ignores required when multiselect is non-empty", () => {
    const p: Parameter = { id: "t", label: "T", type: "multiselect", options: ["a"] };
    expect(validateParam(p, ["a"])).toBeNull();
  });

  it("flags required when multiselect is empty array", () => {
    const p: Parameter = { id: "t", label: "T", type: "multiselect", options: ["a"] };
    expect(validateParam(p, [])).toEqual({ kind: "required" });
  });

  it("regex passes matching text", () => {
    const p: Parameter = { id: "x", label: "X", type: "text", pattern: "^[a-z]+$" };
    expect(validateParam(p, "abc")).toBeNull();
  });

  it("regex fails non-matching text", () => {
    const p: Parameter = { id: "x", label: "X", type: "text", pattern: "^[a-z]+$" };
    expect(validateParam(p, "ABC")).toEqual({ kind: "regex", pattern: "^[a-z]+$" });
  });

  it("number under min returns min error", () => {
    const p: Parameter = { id: "n", label: "N", type: "number", min: 10 };
    expect(validateParam(p, 5)).toEqual({ kind: "min", min: 10 });
  });

  it("number over max returns max error", () => {
    const p: Parameter = { id: "n", label: "N", type: "number", max: 10 };
    expect(validateParam(p, 15)).toEqual({ kind: "max", max: 10 });
  });

  it("slider in range passes", () => {
    const p: Parameter = { id: "q", label: "Q", type: "slider", min: 0, max: 100 };
    expect(validateParam(p, 50)).toBeNull();
  });

  it("date before min returns min error", () => {
    const p: Parameter = { id: "d", label: "D", type: "date", min: "2020-01-01" };
    expect(validateParam(p, "2019-12-31")).toEqual({ kind: "min", min: "2020-01-01" });
  });

  it("date in range passes", () => {
    const p: Parameter = { id: "d", label: "D", type: "date", min: "2020-01-01", max: "2030-12-31" };
    expect(validateParam(p, "2026-04-27")).toBeNull();
  });

  it("select rejects value not in options", () => {
    const p: Parameter = { id: "s", label: "S", type: "select", options: ["a", "b"] };
    expect(validateParam(p, "c")).toEqual({ kind: "enum" });
  });

  it("multiselect rejects values not in options", () => {
    const p: Parameter = { id: "t", label: "T", type: "multiselect", options: ["a", "b"] };
    expect(validateParam(p, ["a", "c"])).toEqual({ kind: "enum" });
  });

  it("ignores malformed regex (caught at parse time)", () => {
    const p: Parameter = { id: "x", label: "X", type: "text", pattern: "[unclosed" };
    expect(validateParam(p, "anything")).toBeNull();
  });
});

describe("validateValues", () => {
  it("returns one error per invalid param", () => {
    const params: Parameter[] = [
      { id: "name", label: "Name", type: "text" },
      { id: "age", label: "Age", type: "number", min: 18 },
    ];
    const errs = validateValues(params, { name: "alice", age: 12 });
    expect(errs.size).toBe(1);
    expect(errs.get("age")).toEqual({ kind: "min", min: 18 });
  });

  it("returns empty map when all valid", () => {
    const params: Parameter[] = [{ id: "n", label: "N", type: "text", optional: true }];
    expect(validateValues(params, {}).size).toBe(0);
  });
});

describe("errorMessage", () => {
  it("uses 'Pick' for date required", () => {
    const p: Parameter = { id: "d", label: "Birthday", type: "date" };
    expect(errorMessage(p, { kind: "required" })).toBe("Pick birthday");
  });

  it("uses 'Select' for multiselect required", () => {
    const p: Parameter = { id: "t", label: "Tags", type: "multiselect", options: [] };
    expect(errorMessage(p, { kind: "required" })).toBe("Select tags");
  });

  it("formats min error with the bound", () => {
    const p: Parameter = { id: "n", label: "N", type: "number", min: 5 };
    expect(errorMessage(p, { kind: "min", min: 5 })).toBe("Must be 5 or more");
  });
});
