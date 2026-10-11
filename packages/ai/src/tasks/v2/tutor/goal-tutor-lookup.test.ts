import { describe, expect, it, vi } from "vitest";
import { type GoalTutorLookUpRequest, createLookUpTool } from "./goal-tutor-lookup";

const REQUEST: GoalTutorLookUpRequest = { area: null, query: "Lei 8.112", what: "noticeTopics" };

/** A lookup stuck on a slow database. */
const neverEnds = () => new Promise<never>(() => {});

const fails = () => Promise.reject(new Error("Database unavailable"));

function runTool({ lookUp, signal }: { lookUp: () => Promise<never>; signal: AbortSignal }) {
  const lookUpTool = createLookUpTool(vi.fn(lookUp));

  return lookUpTool.execute?.(REQUEST, {
    abortSignal: signal,
    context: {},
    messages: [],
    toolCallId: "call",
  });
}

describe(createLookUpTool, () => {
  it("answers without the lookup once its deadline passes, so the buddy still replies", async () => {
    await expect(
      runTool({ lookUp: neverEnds, signal: AbortSignal.timeout(10) }),
    ).resolves.toStrictEqual({ reason: "timeout", status: "unavailable", what: "noticeTopics" });
  });

  it("lets a failed lookup fail as itself", async () => {
    await expect(runTool({ lookUp: fails, signal: new AbortController().signal })).rejects.toThrow(
      "Database unavailable",
    );
  });
});
