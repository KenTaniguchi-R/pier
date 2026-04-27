import { describe, it, expect } from "vitest";
import { reducer, initialState } from "../reducer";
import type { Tool } from "../../domain/tool";

const t: Tool = { id: "x", name: "X", command: "/x" };

describe("reducer", () => {
  it("CONFIG_LOADED stores tools and clears errors", () => {
    const start = { ...initialState, configErrors: ["old error"] };
    const s = reducer(start, { type: "CONFIG_LOADED", tools: [t] });
    expect(s.tools.length).toBe(1);
    expect(s.configErrors).toEqual([]);
  });

  it("CONFIG_LOADED preserves defaults when present", () => {
    const s = reducer(initialState, {
      type: "CONFIG_LOADED",
      tools: [],
      defaults: { envFile: ".env", cwd: "/tmp" },
    });
    expect(s.defaults?.envFile).toBe(".env");
    expect(s.defaults?.cwd).toBe("/tmp");
  });

  it("CONFIG_ERROR stores errors", () => {
    const s = reducer(initialState, { type: "CONFIG_ERROR", errors: ["bad"] });
    expect(s.configErrors).toEqual(["bad"]);
  });

  it("RUN_STARTED creates a run entry and selects it", () => {
    const s = reducer(initialState, { type: "RUN_STARTED", runId: "r1", toolId: "x", startedAt: 1 });
    expect(s.runs["r1"].status).toBe("running");
    expect(s.selectedRunIdByTool["x"]).toBe("r1");
  });

  it("RUN_OUTPUT appends a log line", () => {
    let s = reducer(initialState, { type: "RUN_STARTED", runId: "r1", toolId: "x", startedAt: 1 });
    s = reducer(s, { type: "RUN_OUTPUT", runId: "r1", line: "hi", stream: "stdout", transient: false });
    expect(s.runs["r1"].lines).toHaveLength(1);
    expect(s.runs["r1"].lines[0].line).toBe("hi");
  });

  it("RUN_OUTPUT for unknown runId is no-op", () => {
    const s = reducer(initialState, { type: "RUN_OUTPUT", runId: "ghost", line: "?", stream: "stdout", transient: false });
    expect(s).toEqual(initialState);
  });

  it("RUN_OUTPUT collapses consecutive transient segments into one row", () => {
    let s = reducer(initialState, { type: "RUN_STARTED", runId: "r1", toolId: "x", startedAt: 1 });
    s = reducer(s, { type: "RUN_OUTPUT", runId: "r1", line: "10%", stream: "stdout", transient: true });
    s = reducer(s, { type: "RUN_OUTPUT", runId: "r1", line: "50%", stream: "stdout", transient: true });
    s = reducer(s, { type: "RUN_OUTPUT", runId: "r1", line: "100%", stream: "stdout", transient: false });
    expect(s.runs["r1"].lines).toHaveLength(1);
    expect(s.runs["r1"].lines[0].line).toBe("100%");
    expect(s.runs["r1"].lines[0].transient).toBe(false);
  });

  it("RUN_OUTPUT does not collapse a transient stderr onto a transient stdout", () => {
    let s = reducer(initialState, { type: "RUN_STARTED", runId: "r1", toolId: "x", startedAt: 1 });
    s = reducer(s, { type: "RUN_OUTPUT", runId: "r1", line: "out", stream: "stdout", transient: true });
    s = reducer(s, { type: "RUN_OUTPUT", runId: "r1", line: "err", stream: "stderr", transient: true });
    expect(s.runs["r1"].lines.map(l => l.line)).toEqual(["out", "err"]);
  });

  it("RUN_EXIT updates status and exit code", () => {
    let s = reducer(initialState, { type: "RUN_STARTED", runId: "r1", toolId: "x", startedAt: 1 });
    s = reducer(s, { type: "RUN_EXIT", runId: "r1", status: "success", exitCode: 0, endedAt: 2 });
    expect(s.runs["r1"].status).toBe("success");
    expect(s.runs["r1"].exitCode).toBe(0);
    expect(s.runs["r1"].endedAt).toBe(2);
  });

  it("RUN_STARTED for a second run on the same tool replaces the selection", () => {
    let s = reducer(initialState, { type: "RUN_STARTED", runId: "r1", toolId: "x", startedAt: 1 });
    s = reducer(s, { type: "RUN_STARTED", runId: "r2", toolId: "x", startedAt: 2 });
    expect(s.selectedRunIdByTool["x"]).toBe("r2");
    expect(s.runs["r1"]).toBeDefined();
    expect(s.runs["r2"]).toBeDefined();
  });

  it("RUN_STARTED tracks selection per tool independently", () => {
    let s = reducer(initialState, { type: "RUN_STARTED", runId: "r1", toolId: "x", startedAt: 1 });
    s = reducer(s, { type: "RUN_STARTED", runId: "r2", toolId: "y", startedAt: 2 });
    expect(s.selectedRunIdByTool["x"]).toBe("r1");
    expect(s.selectedRunIdByTool["y"]).toBe("r2");
  });
});
