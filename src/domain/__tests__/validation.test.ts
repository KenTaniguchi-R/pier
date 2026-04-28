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
        parameters: [{ id: "format", label: "Format", type: "select" }] }],
    });
  });

  it("rejects duplicate parameter ids within a tool", () => {
    const errs = fail({
      schemaVersion: "1.0",
      tools: [{ id: "x", name: "X", command: "/x",
        parameters: [
          { id: "a", label: "A", type: "text" },
          { id: "a", label: "A", type: "text" },
        ] }],
    });
    expect(errs.join(" ")).toMatch(/duplicate.*parameter/i);
  });

  it("rejects unknown placeholder in args", () => {
    const errs = fail({
      schemaVersion: "1.0",
      tools: [{ id: "x", name: "X", command: "/x",
        args: ["{ghost}"],
        parameters: [{ id: "real", label: "Real", type: "text" }] }],
    });
    expect(errs.join(" ")).toMatch(/ghost/);
  });

  it("rejects select default not in options", () => {
    fail({
      schemaVersion: "1.0",
      tools: [{ id: "x", name: "X", command: "/x",
        parameters: [{ id: "f", label: "Format", type: "select", options: ["a", "b"], default: "c" }] }],
    });
  });

  it("rejects number default that is not a number", () => {
    fail({
      schemaVersion: "1.0",
      tools: [{ id: "x", name: "X", command: "/x",
        parameters: [{ id: "n", label: "Number", type: "number", default: "five" }] }],
    });
  });

  it("accepts envFile and env on a tool", () => {
    const r = parseToolsConfig({
      schemaVersion: "1.0",
      tools: [{
        id: "x", name: "X", command: "/x",
        envFile: ".env",
        env: { DEBUG: "1", KEY: "${keychain:k}" },
      }],
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.tools[0].envFile).toBe(".env");
      expect(r.value.tools[0].env?.DEBUG).toBe("1");
    }
  });

  it("rejects env values that aren't strings", () => {
    const r = parseToolsConfig({
      schemaVersion: "1.0",
      tools: [{ id: "x", name: "X", command: "/x", env: { K: 123 } as never }],
    });
    expect(r.ok).toBe(false);
  });

  it("rejects envFile that isn't a string", () => {
    const r = parseToolsConfig({
      schemaVersion: "1.0",
      tools: [{ id: "x", name: "X", command: "/x", envFile: 5 as never }],
    });
    expect(r.ok).toBe(false);
  });

  it("accepts top-level defaults block", () => {
    const r = parseToolsConfig({
      schemaVersion: "1.0",
      defaults: { envFile: ".env", env: { DEBUG: "1" } },
      tools: [{ id: "x", name: "X", command: "/x" }],
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.defaults?.envFile).toBe(".env");
  });

  it("rejects defaults.env with non-string values", () => {
    const r = parseToolsConfig({
      schemaVersion: "1.0",
      defaults: { env: { K: true } as never },
      tools: [],
    });
    expect(r.ok).toBe(false);
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
          { id: "input", label: "Input file", type: "file", accepts: [".mov"] },
          { id: "fmt", label: "Format", type: "select", options: ["mp4", "webm"], default: "mp4" },
          { id: "dry", label: "Dry run", type: "boolean", flag: "--dry-run", optional: true },
        ],
      }],
    });
  });
});

describe("parseToolsConfig — label requirement", () => {
  it("rejects a parameter that omits label", () => {
    const result = parseToolsConfig({
      schemaVersion: "1.0",
      tools: [{
        id: "t", name: "T", command: "/x",
        parameters: [{ id: "input", type: "file" }],
      }],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some(e => /label/.test(e) && /input/.test(e))).toBe(true);
    }
  });

  it("accepts a parameter with label", () => {
    const result = parseToolsConfig({
      schemaVersion: "1.0",
      tools: [{
        id: "t", name: "T", command: "/x",
        parameters: [{ id: "input", label: "Input file", type: "file" }],
      }],
    });
    expect(result.ok).toBe(true);
  });

  it("accepts a parameter with advanced: true", () => {
    const result = parseToolsConfig({
      schemaVersion: "1.0",
      tools: [{
        id: "t", name: "T", command: "/x",
        parameters: [{ id: "fmt", label: "Format", type: "select", options: ["a"], advanced: true }],
      }],
    });
    expect(result.ok).toBe(true);
  });
});

describe("parseToolsConfig — multiselect", () => {
  const wrap = (param: object) => ({
    schemaVersion: "1.0",
    tools: [{
      id: "x", name: "X", command: "/x",
      parameters: [{ id: "p", label: "P", ...param }],
    }],
  });

  it("accepts a valid multiselect with default subset", () => {
    ok(wrap({ type: "multiselect", options: ["a", "b"], default: ["a"] }));
  });

  it("rejects multiselect missing options", () => {
    fail(wrap({ type: "multiselect" }));
  });

  it("rejects multiselect default not in options", () => {
    fail(wrap({ type: "multiselect", options: ["a", "b"], default: ["c"] }));
  });

  it("rejects multiselect default that isn't an array", () => {
    fail(wrap({ type: "multiselect", options: ["a"], default: "a" }));
  });
});

describe("parseToolsConfig — slider", () => {
  const wrap = (param: object) => ({
    schemaVersion: "1.0",
    tools: [{
      id: "x", name: "X", command: "/x",
      parameters: [{ id: "p", label: "P", ...param }],
    }],
  });

  it("accepts a valid slider", () => {
    ok(wrap({ type: "slider", min: 0, max: 100, step: 5, default: 50 }));
  });

  it("rejects slider missing min/max", () => {
    fail(wrap({ type: "slider" }));
  });

  it("rejects slider with min >= max", () => {
    fail(wrap({ type: "slider", min: 10, max: 5 }));
  });
});

describe("parseToolsConfig — date", () => {
  const wrap = (param: object) => ({
    schemaVersion: "1.0",
    tools: [{
      id: "x", name: "X", command: "/x",
      parameters: [{ id: "p", label: "P", ...param }],
    }],
  });

  it("accepts a valid date param with bounds", () => {
    ok(wrap({ type: "date", min: "2020-01-01", max: "2030-12-31" }));
  });

  it("rejects date min that isn't a string", () => {
    fail(wrap({ type: "date", min: 12345 }));
  });
});

describe("parseToolsConfig — pattern (regex)", () => {
  it("accepts a valid regex pattern on text", () => {
    ok({
      schemaVersion: "1.0",
      tools: [{
        id: "x", name: "X", command: "/x",
        parameters: [{ id: "p", label: "P", type: "text", pattern: "^[a-z]+$" }],
      }],
    });
  });

  it("rejects an invalid regex pattern", () => {
    fail({
      schemaVersion: "1.0",
      tools: [{
        id: "x", name: "X", command: "/x",
        parameters: [{ id: "p", label: "P", type: "text", pattern: "[unclosed" }],
      }],
    });
  });
});
