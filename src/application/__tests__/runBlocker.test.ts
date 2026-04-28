import { describe, it, expect } from "vitest";
import type { Parameter } from "../../domain/tool";
import { findBlocker, blockerLabel } from "../runBlocker";

const file: Parameter = { id: "video", label: "English video", type: "file" };
const text: Parameter = { id: "prompt", label: "Prompt", type: "text" };
const folder: Parameter = { id: "out", label: "Output folder", type: "folder" };
const optional: Parameter = { id: "tag", label: "Tag", type: "text", optional: true };

describe("findBlocker", () => {
  it("returns the first required param missing a value", () => {
    expect(findBlocker([file, text], { video: "", prompt: "" })?.param).toBe(file);
    expect(findBlocker([file, text], { video: "/x.mp4", prompt: "" })?.param).toBe(text);
  });

  it("returns null when all required params are filled", () => {
    expect(findBlocker([file, text], { video: "/x.mp4", prompt: "hi" })).toBeNull();
  });

  it("ignores optional params", () => {
    expect(findBlocker([file, optional], { video: "/x.mp4", tag: "" })).toBeNull();
  });

  it("surfaces non-required errors (e.g. regex) once a value is set", () => {
    const slug: Parameter = { id: "s", label: "Slug", type: "text", pattern: "^[a-z]+$" };
    const b = findBlocker([slug], { s: "BAD" });
    expect(b?.error.kind).toBe("regex");
  });
});

describe("blockerLabel", () => {
  it("uses 'Add' for required files", () => {
    expect(blockerLabel({ param: file, error: { kind: "required" } }))
      .toBe("Add english video to run");
  });

  it("uses 'Choose' for required folders", () => {
    expect(blockerLabel({ param: folder, error: { kind: "required" } }))
      .toBe("Choose output folder to run");
  });

  it("uses 'Enter' for required text params", () => {
    expect(blockerLabel({ param: text, error: { kind: "required" } }))
      .toBe("Enter prompt to run");
  });

  it("renders a generic 'Fix X' label for non-required errors", () => {
    const slug: Parameter = { id: "s", label: "Slug", type: "text", pattern: "^[a-z]+$" };
    expect(blockerLabel({ param: slug, error: { kind: "regex", pattern: "^[a-z]+$" } }))
      .toBe("Fix slug to run");
  });
});
