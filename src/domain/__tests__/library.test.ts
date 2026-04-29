import { describe, it, expect } from "vitest";
import type { Catalog } from "../library";

describe("Catalog type", () => {
  it("accepts a valid minimal catalog at compile + runtime", () => {
    const cat: Catalog = {
      catalogSchemaVersion: 1,
      publishedAt: "2026-05-15T00:00:00Z",
      tools: [{
        id: "kill-port",
        name: "Kill port",
        version: "1.0.0",
        description: "Free a port.",
        category: "dev",
        permissions: { network: false, fsRead: [], fsWrite: [] },
        script: "#!/bin/sh\nlsof -ti:$1 | xargs kill -9\n",
      }],
    };
    expect(cat.tools[0].id).toBe("kill-port");
  });
});
