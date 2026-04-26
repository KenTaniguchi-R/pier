import { describe, it, expect } from "vitest";
import { parseToolsConfig } from "../validation";

describe("parseToolsConfig", () => {
  it("accepts a valid v1 config with one file-input tool", () => {
    const json = {
      schemaVersion: "1.0",
      tools: [{ id: "x", name: "X", command: "/bin/echo", inputType: "file" }],
    };
    const result = parseToolsConfig(json);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.tools[0].id).toBe("x");
  });

  it("rejects config missing schemaVersion", () => {
    const result = parseToolsConfig({ tools: [] });
    expect(result.ok).toBe(false);
  });

  it("rejects tool with unknown inputType", () => {
    const json = {
      schemaVersion: "1.0",
      tools: [{ id: "x", name: "X", command: "/bin/x", inputType: "weird" }],
    };
    expect(parseToolsConfig(json).ok).toBe(false);
  });

  it("rejects duplicate tool ids", () => {
    const json = {
      schemaVersion: "1.0",
      tools: [
        { id: "x", name: "A", command: "/a", inputType: "none" },
        { id: "x", name: "B", command: "/b", inputType: "none" },
      ],
    };
    expect(parseToolsConfig(json).ok).toBe(false);
  });
});
