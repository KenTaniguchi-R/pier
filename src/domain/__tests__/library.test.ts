import { describe, it, expect } from "vitest";
import type { Catalog, CatalogTool } from "../library";

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
        permissions: { network: "none", files: "none", system: "none", sentences: [] },
        script: "#!/bin/sh\nlsof -ti:$1 | xargs kill -9\n",
      }],
    };
    expect(cat.tools[0].id).toBe("kill-port");
  });
});

describe("CatalogTool optional v0.3 fields", () => {
  it("accepts outcome, audience, examples, featured, addedAt", () => {
    const t: CatalogTool = {
      id: "kill-port",
      name: "Kill process on port",
      version: "1.0.0",
      description: "Free up a port held by a stuck process.",
      category: "system",
      outcome: "Free up a stuck port",
      audience: ["developer"],
      examples: ["pier kill-port 3000"],
      featured: true,
      addedAt: "2026-04-20",
      permissions: {
        network: "none",
        files: "read-only",
        system: "kills-processes",
        sentences: ["runs-locally", "may-terminate-processes"],
      },
    };
    expect(t.outcome).toBe("Free up a stuck port");
    expect(t.audience).toEqual(["developer"]);
    expect(t.permissions.sentences).toContain("runs-locally");
  });

  it("treats outcome/audience/examples/featured/addedAt as optional", () => {
    const t: CatalogTool = {
      id: "x",
      name: "X",
      version: "1.0.0",
      description: "y",
      category: "general",
      permissions: { network: "none", files: "none", system: "none", sentences: [] },
    };
    expect(t.outcome).toBeUndefined();
    expect(t.audience).toBeUndefined();
  });
});
