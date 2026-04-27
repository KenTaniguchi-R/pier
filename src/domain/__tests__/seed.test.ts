import { describe, it, expect } from "vitest";
import { parseToolsConfig } from "../validation";
import seed from "../../../examples/tools.json";

describe("seed examples/tools.json", () => {
  it("parses with the current validator", () => {
    const r = parseToolsConfig(seed);
    if (!r.ok) console.error(r.errors);
    expect(r.ok).toBe(true);
  });
});
