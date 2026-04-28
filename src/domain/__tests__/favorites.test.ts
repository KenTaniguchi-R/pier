import { describe, it, expect } from "vitest";
import { isPinned, togglePin, pruneMissing, FAVORITES_CAP } from "../favorites";

describe("favorites", () => {
  describe("isPinned", () => {
    it("reports membership", () => {
      expect(isPinned(["a", "b"], "a")).toBe(true);
      expect(isPinned(["a", "b"], "c")).toBe(false);
      expect(isPinned([], "a")).toBe(false);
    });
  });

  describe("togglePin", () => {
    it("appends an id that is not present", () => {
      expect(togglePin(["a"], "b")).toEqual(["a", "b"]);
    });

    it("removes an id that is present", () => {
      expect(togglePin(["a", "b", "c"], "b")).toEqual(["a", "c"]);
    });

    it("does not duplicate when adding twice", () => {
      const after = togglePin(togglePin([], "a"), "a");
      expect(after).toEqual([]);
    });

    it("returns the same reference when blocked at cap", () => {
      const full = ["a", "b", "c", "d", "e", "f", "g", "h"];
      expect(full.length).toBe(FAVORITES_CAP);
      const after = togglePin(full, "z");
      expect(after).toBe(full);
    });

    it("still removes when at cap", () => {
      const full = ["a", "b", "c", "d", "e", "f", "g", "h"];
      expect(togglePin(full, "d")).toEqual(["a", "b", "c", "e", "f", "g", "h"]);
    });

    it("uses a custom cap when provided", () => {
      expect(togglePin(["a", "b"], "c", 2)).toEqual(["a", "b"]);
    });
  });

  describe("pruneMissing", () => {
    it("filters ids not in the known set, preserving order", () => {
      expect(pruneMissing(["a", "b", "c"], new Set(["a", "c"]))).toEqual(["a", "c"]);
    });

    it("returns empty when known is empty", () => {
      expect(pruneMissing(["a", "b"], new Set())).toEqual([]);
    });
  });
});
