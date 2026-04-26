import { describe, it, expect } from "vitest";
import { parseToolsConfig } from "../validation";

const ok = (input: unknown) => {
  const r = parseToolsConfig(input);
  if (!r.ok) throw new Error("expected ok, got: " + r.errors.join(", "));
  return r.value;
};
const fail = (input: unknown): string[] => {
  const r = parseToolsConfig(input);
  if (r.ok) throw new Error("expected fail");
  return r.errors;
};

describe("parseToolsConfig — basics", () => {
  it("accepts an empty parameters list", () => {
    const cfg = ok({
      schemaVersion: "1.0",
      tools: [{ id: "x", name: "X", command: "/bin/echo", parameters: [] }],
    });
    expect(cfg.tools[0].parameters).toEqual([]);
  });

  it("accepts a tool with parameters omitted", () => {
    ok({
      schemaVersion: "1.0",
      tools: [{ id: "x", name: "X", command: "/bin/echo" }],
    });
  });

  it("rejects missing schemaVersion", () => {
    fail({ tools: [] });
  });

  it("rejects duplicate tool ids", () => {
    fail({
      schemaVersion: "1.0",
      tools: [
        { id: "x", name: "A", command: "/a" },
        { id: "x", name: "B", command: "/b" },
      ],
    });
  });

  it("rejects legacy inputType field with a clear message", () => {
    const errs = fail({
      schemaVersion: "1.0",
      tools: [{ id: "x", name: "X", command: "/x", inputType: "file" }],
    });
    expect(errs.join(" ")).toMatch(/inputType.*parameters/i);
  });
});

describe("parseToolsConfig — parameters", () => {
  it("validates a select param requires options", () => {
    fail({
      schemaVersion: "1.0",
      tools: [{ id: "x", name: "X", command: "/x",
        parameters: [{ id: "format", type: "select" }] }],
    });
  });

  it("rejects duplicate parameter ids within a tool", () => {
    const errs = fail({
      schemaVersion: "1.0",
      tools: [{ id: "x", name: "X", command: "/x",
        parameters: [
          { id: "a", type: "text" },
          { id: "a", type: "text" },
        ] }],
    });
    expect(errs.join(" ")).toMatch(/duplicate.*parameter/i);
  });

  it("rejects unknown placeholder in args", () => {
    const errs = fail({
      schemaVersion: "1.0",
      tools: [{ id: "x", name: "X", command: "/x",
        args: ["{ghost}"],
        parameters: [{ id: "real", type: "text" }] }],
    });
    expect(errs.join(" ")).toMatch(/ghost/);
  });

  it("rejects select default not in options", () => {
    fail({
      schemaVersion: "1.0",
      tools: [{ id: "x", name: "X", command: "/x",
        parameters: [{ id: "f", type: "select", options: ["a", "b"], default: "c" }] }],
    });
  });

  it("rejects number default that is not a number", () => {
    fail({
      schemaVersion: "1.0",
      tools: [{ id: "x", name: "X", command: "/x",
        parameters: [{ id: "n", type: "number", default: "five" }] }],
    });
  });

  it("accepts a valid file + select + boolean tool", () => {
    ok({
      schemaVersion: "1.0",
      tools: [{
        id: "convert",
        name: "Convert",
        command: "/usr/bin/ffmpeg",
        args: ["-i", "{input}"],
        parameters: [
          { id: "input", type: "file", accepts: [".mov"] },
          { id: "fmt", type: "select", options: ["mp4", "webm"], default: "mp4" },
          { id: "dry", type: "boolean", flag: "--dry-run", optional: true },
        ],
      }],
    });
  });
});
