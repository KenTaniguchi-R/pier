import { describe, it, expect } from "vitest";
import type { Parameter } from "../../domain/tool";
import { findBlocker, blockerLabel } from "../runBlocker";

const file: Parameter = { id: "video", label: "English video", type: "file" };
const text: Parameter = { id: "prompt", label: "Prompt", type: "text" };
const folder: Parameter = { id: "out", label: "Output folder", type: "folder" };
const optional: Parameter = { id: "tag", label: "Tag", type: "text", optional: true };

describe("findBlocker", () => {
  it("returns the first required param missing a value", () => {
    expect(findBlocker([file, text], { video: "", prompt: "" })).toBe(file);
    expect(findBlocker([file, text], { video: "/x.mp4", prompt: "" })).toBe(text);
  });

  it("returns null when all required params are filled", () => {
    expect(findBlocker([file, text], { video: "/x.mp4", prompt: "hi" })).toBeNull();
  });

  it("ignores optional params", () => {
    expect(findBlocker([file, optional], { video: "/x.mp4", tag: "" })).toBeNull();
  });
});

describe("blockerLabel", () => {
  it("uses 'Add' for files", () => {
    expect(blockerLabel(file)).toBe("Add english video to run");
  });

  it("uses 'Choose' for folders", () => {
    expect(blockerLabel(folder)).toBe("Choose output folder to run");
  });

  it("uses 'Enter' for text params", () => {
    expect(blockerLabel(text)).toBe("Enter prompt to run");
  });
});
