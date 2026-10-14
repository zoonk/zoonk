import { describe, expect, it, vi } from "vitest";
import { TEST_TUTOR_LINKS } from "../_test-utils/tutor-links";
import {
  type GoalTutorLookUpRequest,
  type GoalTutorLookUpResult,
  createLookUpTool,
} from "./goal-tutor-lookup";

const REQUEST: GoalTutorLookUpRequest = { area: null, query: "Lei 8.112", what: "noticeTopics" };

/** A lookup stuck on a slow database. */
const neverEnds = () => new Promise<never>(() => {});

const fails = () => Promise.reject(new Error("Database unavailable"));

const CALL = { context: {}, messages: [], toolCallId: "call" };

function runTool({ lookUp, signal }: { lookUp: () => Promise<never>; signal: AbortSignal }) {
  const lookUpTool = createLookUpTool({ links: TEST_TUTOR_LINKS, lookUp: vi.fn(lookUp) });

  return lookUpTool.execute?.(REQUEST, { ...CALL, abortSignal: signal });
}

const FOUND: GoalTutorLookUpResult = {
  lessons: [
    {
      canDo: null,
      date: "2026-10-15",
      description: "Why atoms are stable",
      done: false,
      ideas: [],
      title: "Electron orbitals",
    },
  ],
  status: "found",
  what: "lesson",
};

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

  it("answers a message's fourth lookup without reading anything, so it can't loop over the learner's data", async () => {
    const lookUp = vi.fn(() => Promise.resolve(FOUND));
    const lookUpTool = createLookUpTool({ links: TEST_TUTOR_LINKS, lookUp });
    const signal = new AbortController().signal;

    const results = [];

    for (const _ of [1, 2, 3, 4]) {
      // oxlint-disable-next-line no-await-in-loop -- each lookup follows the one before, as steps do
      results.push(await lookUpTool.execute?.(REQUEST, { ...CALL, abortSignal: signal }));
    }

    expect(lookUp).toHaveBeenCalledTimes(3);

    expect(results.at(-1)).toStrictEqual({
      reason: "limit",
      status: "unavailable",
      what: "noticeTopics",
    });
  });

  it("gives the model the host's link wherever a result points at something the app opens", async () => {
    const lookUpTool = createLookUpTool({ links: TEST_TUTOR_LINKS, lookUp: vi.fn() });

    const found: GoalTutorLookUpResult = {
      ...FOUND,
      // A result's link, as core points at what the app opens.
      lessons: FOUND.lessons.map((lesson) => ({
        ...lesson,
        link: { kind: "challenge", planItemId: "item-1" },
      })),
    } as GoalTutorLookUpResult;

    const output = await lookUpTool.toModelOutput?.({
      input: REQUEST,
      output: found,
      toolCallId: "call",
    });

    expect(output).toMatchObject({ type: "text" });
    expect(output?.type === "text" && output.value).toContain('"link":"/challenge/item-1"');
  });
});
