import { describe, it, expect } from "vitest";
import { buildArgs } from "../argTemplate";
import type { Tool } from "../../domain/tool";

const tool = (overrides: Partial<Tool>): Tool => ({
  id: "t",
  name: "T",
  command: "/bin/echo",
  ...overrides,
});

describe("buildArgs", () => {
  it("substitutes {id} placeholders in positional args", () => {
    const t = tool({
      args: ["-i", "{input}"],
      parameters: [{ id: "input", label: "Input file", type: "file" }],
    });
    expect(buildArgs(t, { input: "/tmp/a.mov" })).toEqual(["-i", "/tmp/a.mov"]);
  });

  it("drops a positional arg whose placeholder param is empty + optional", () => {
    const t = tool({
      args: ["-i", "{input}", "{extra}"],
      parameters: [
        { id: "input", label: "Input file", type: "file" },
        { id: "extra", label: "Extra", type: "text", optional: true },
      ],
    });
    expect(buildArgs(t, { input: "/a", extra: "" })).toEqual(["-i", "/a"]);
  });

  it("emits flag + value when a flagged param is set", () => {
    const t = tool({
      args: ["{input}"],
      parameters: [
        { id: "input", label: "Input file", type: "file" },
        { id: "bitrate", label: "Bitrate", type: "text", flag: "-b:v", optional: true },
      ],
    });
    expect(buildArgs(t, { input: "/a", bitrate: "5000k" })).toEqual([
      "/a", "-b:v", "5000k",
    ]);
  });

  it("omits the flag entirely when an optional flagged param is empty", () => {
    const t = tool({
      args: ["{input}"],
      parameters: [
        { id: "input", label: "Input file", type: "file" },
        { id: "bitrate", label: "Bitrate", type: "text", flag: "-b:v", optional: true },
      ],
    });
    expect(buildArgs(t, { input: "/a", bitrate: "" })).toEqual(["/a"]);
  });

  it("emits a boolean true as flag-only", () => {
    const t = tool({
      parameters: [{ id: "dry", label: "Dry run", type: "boolean", flag: "--dry-run" }],
    });
    expect(buildArgs(t, { dry: true })).toEqual(["--dry-run"]);
  });

  it("omits a boolean false even with flag set", () => {
    const t = tool({
      parameters: [{ id: "dry", label: "Dry run", type: "boolean", flag: "--dry-run" }],
    });
    expect(buildArgs(t, { dry: false })).toEqual([]);
  });

  it("emits flags in parameters[] declaration order, after positional args", () => {
    const t = tool({
      args: ["{input}"],
      parameters: [
        { id: "input", label: "Input file", type: "file" },
        { id: "a", label: "A", type: "text", flag: "-a" },
        { id: "b", label: "B", type: "text", flag: "-b" },
      ],
    });
    expect(buildArgs(t, { input: "/x", a: "1", b: "2" })).toEqual([
      "/x", "-a", "1", "-b", "2",
    ]);
  });

  it("coerces numbers to string", () => {
    const t = tool({
      args: ["-p", "{port}"],
      parameters: [{ id: "port", label: "Port", type: "number" }],
    });
    expect(buildArgs(t, { port: 8080 })).toEqual(["-p", "8080"]);
  });

  it("returns empty when tool has no args and no flagged params", () => {
    expect(buildArgs(tool({}), {})).toEqual([]);
  });
});
