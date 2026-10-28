import { describe, expect, it, vi } from "vitest";
import { TEST_TUTOR_LINKS } from "../_test-utils/tutor-links";
import {
  type GoalTutorLookUpRequest,
  type GoalTutorLookUpResult,
  createLookUpTool,
} from "./goal-tutor-lookup";

const REQUEST: GoalTutorLookUpRequest = { area: null, query: "Lei 8.112", what: "noticeTopics" };

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
  it("looks up the time that covers everything as one more kind of the same tool, for every step", async () => {
    const lookUp = vi.fn(() => Promise.resolve(FOUND));
    const first = createLookUpTool({ links: TEST_TUTOR_LINKS, lookUp });
    const next = createLookUpTool({ links: TEST_TUTOR_LINKS, lookUp });
    const request = { area: null, query: null, what: "timeToCover" } as const;

    // The tool reads the same on every step and for every learner, so it stays cached.
    expect(first.description).toBe(next.description);
    expect(first.description).toContain("- timeToCover: ");

    await first.execute?.(request, { ...CALL, abortSignal: new AbortController().signal });
    expect(lookUp).toHaveBeenCalledWith(request);
  });

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

  it("passes an unsaved challenge's null link to the model without constructing a URL", async () => {
    const toLink = vi.fn(TEST_TUTOR_LINKS.toLink);
    const tool = createLookUpTool({ links: { ...TEST_TUTOR_LINKS, toLink }, lookUp: vi.fn() });

    const output = await tool.toModelOutput?.({
      input: { area: null, query: null, what: "challenges" },
      output: {
        challenges: [
          {
            date: "2026-10-16",
            kind: "challenge",
            link: null,
            locked: false,
            phase: null,
            when: "date",
          },
        ],
        done: { challenges: 0, mocks: 0, weekly: 0 },
        more: 0,
        status: "found",
        what: "challenges",
      },
      toolCallId: "call",
    });

    expect(toLink).not.toHaveBeenCalled();

    expect(output?.type === "text" && JSON.parse(output.value)).toMatchObject({
      challenges: [{ date: "2026-10-16", kind: "challenge", link: null }],
    });
  });
});
