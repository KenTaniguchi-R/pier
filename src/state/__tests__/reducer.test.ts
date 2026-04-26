import { describe, it, expect } from "vitest";
import { reducer, initialState } from "../reducer";
import type { Tool } from "../../domain/tool";

const t: Tool = { id: "x", name: "X", command: "/x", inputType: "none" };

describe("reducer", () => {
  it("CONFIG_LOADED stores tools and clears errors", () => {
    const start = { ...initialState, configErrors: ["old error"] };
    const s = reducer(start, { type: "CONFIG_LOADED", tools: [t] });
    expect(s.tools.length).toBe(1);
    expect(s.configErrors).toEqual([]);
  });

  it("CONFIG_ERROR stores errors", () => {
    const s = reducer(initialState, { type: "CONFIG_ERROR", errors: ["bad"] });
    expect(s.configErrors).toEqual(["bad"]);
  });

  it("RUN_STARTED creates a run entry and selects it", () => {
    const s = reducer(initialState, { type: "RUN_STARTED", runId: "r1", toolId: "x", startedAt: 1 });
    expect(s.runs["r1"].status).toBe("running");
    expect(s.selectedRunId).toBe("r1");
  });

  it("RUN_OUTPUT appends a log line", () => {
    let s = reducer(initialState, { type: "RUN_STARTED", runId: "r1", toolId: "x", startedAt: 1 });
    s = reducer(s, { type: "RUN_OUTPUT", runId: "r1", line: "hi", stream: "stdout" });
    expect(s.runs["r1"].lines).toHaveLength(1);
    expect(s.runs["r1"].lines[0].line).toBe("hi");
  });

  it("RUN_OUTPUT for unknown runId is no-op", () => {
    const s = reducer(initialState, { type: "RUN_OUTPUT", runId: "ghost", line: "?", stream: "stdout" });
    expect(s).toEqual(initialState);
  });

  it("RUN_EXIT updates status and exit code", () => {
    let s = reducer(initialState, { type: "RUN_STARTED", runId: "r1", toolId: "x", startedAt: 1 });
    s = reducer(s, { type: "RUN_EXIT", runId: "r1", status: "success", exitCode: 0, endedAt: 2 });
    expect(s.runs["r1"].status).toBe("success");
    expect(s.runs["r1"].exitCode).toBe(0);
    expect(s.runs["r1"].endedAt).toBe(2);
  });

  it("SELECT_RUN sets selectedRunId", () => {
    const s = reducer(initialState, { type: "SELECT_RUN", runId: "abc" });
    expect(s.selectedRunId).toBe("abc");
  });
});
