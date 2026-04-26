import { describe, it, expect, vi } from "vitest";
import { loadConfig } from "../loadConfig";

describe("loadConfig", () => {
  it("returns parsed ToolsConfig when loader returns valid raw", async () => {
    const loader = {
      load: vi.fn().mockResolvedValue({
        raw: { schemaVersion: "1.0", tools: [{ id: "a", name: "A", command: "/a" }] },
        pathHint: "/x",
      }),
      watch: vi.fn(),
    };
    const result = await loadConfig(loader);
    expect(result.ok).toBe(true);
  });

  it("returns errors when raw is invalid", async () => {
    const loader = { load: vi.fn().mockResolvedValue({ raw: { tools: [] }, pathHint: "/x" }), watch: vi.fn() };
    const result = await loadConfig(loader);
    expect(result.ok).toBe(false);
  });
});
