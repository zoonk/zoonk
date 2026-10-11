import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runSimLifeInDb } from "./_test-utils/sim/sim-db";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));
vi.mock("../progress/get-request-date-context", () => ({ getRequestProgressDateContext: vi.fn() }));

// The mistake classifier is a paid model call: a wrong answer whose cause isn't clear is a gap here.
vi.mock("@zoonk/ai/tasks/v2/mistakes/cause", () => ({
  classifyMistakeCause: vi.fn(async () => ({ data: { cause: "gap" } })),
}));

// Vercel Blob is the external store a deleted account's files are removed from.
vi.mock("@vercel/blob", () => ({
  del: vi.fn(),
  list: vi.fn(async () => ({ blobs: [], cursor: undefined, hasMore: false })),
}));

const MINUTE = 60_000;

describe("the plan says every topic is in only when none is out for time", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // A class test four days away, a "less" and a focus, then two missed days: on the last study
  // day the plan said every topic's core fits while the syllabus showed two topics out for time.
  it(
    "doesn't say every topic is in on the last study day after topics left for time",
    async () => {
      const { violations } = await runSimLifeInDb(
        {
          dailyMinutes: 20,
          fixture: "class-test",
          knownAreas: [],
          pending: [0],
          seed: 1002,
          speed: 1.2,
          start: "2026-10-12",
          steps: [
            {
              answers: [
                [3, false],
                [3, true],
                [4, true],
                [0, false],
              ],
              kind: "placement",
            },
            { finish: 0, kind: "study", misses: [] },
            { finish: 0.25, kind: "study", misses: [1] },
            { kind: "refresh" },
            { finish: 1, kind: "study", misses: [] },
            { kind: "change", spec: { area: 0, kind: "reduce" }, via: "buddy" },
            { count: 1, kind: "land" },
            { finish: 0.5, kind: "study", misses: [] },
            { kind: "change", spec: { area: 0, kind: "focus" }, via: "buddy" },
            { days: 2, kind: "miss" },
            { finish: 1, kind: "study", misses: [5] },
          ],
          subscribed: false,
          targetInDays: 4,
        },
        { questions: true, rules: ["R25"] },
      );

      expect(violations).toStrictEqual([]);
    },
    5 * MINUTE,
  );
});

/*
 * R25 through the real capabilities: a session's stop rebalanced a Câmara plan in one mode and the
 * plan view read it again in another, which kept a skill more, so the view said every topic's core
 * fits next to 12 topics out for time.
 */
describe("what a plan says it covers right after a session's rebalance", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it(
    "never says every topic fits next to topics out for time in a Câmara plan",
    async () => {
      const { violations } = await runSimLifeInDb(
        {
          dailyMinutes: 240,
          fixture: "camara",
          knownAreas: [10],
          mockOffers: "focus",
          pending: [5, 6, 15, 25, 26, 38, 43, 45, 57, 67, 70, 91, 96, 108],
          seed: 2008,
          speed: 1.5,
          start: "2054-10-12",
          steps: [
            {
              answers: [
                [50, true],
                [97, false],
                [59, false],
                [75, true],
                [24, true],
                [47, true],
                [78, false],
                [27, true],
                [98, false],
                [106, true],
                [58, true],
              ],
              kind: "placement",
            },
            { finish: 1, kind: "study", misses: [49] },
            { count: 1, kind: "land" },
            { finish: 0.25, kind: "study", misses: [1] },
          ],
          subscribed: false,
          targetInDays: 59,
        },
        { questions: true, rules: ["R25"] },
      );

      expect(violations).toStrictEqual([]);
    },
    10 * MINUTE,
  );
});
