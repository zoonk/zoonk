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

/*
 * R11 through the real capabilities, where the learner's answers in sessions and an undone
 * placement reach the cut. Class test seed 1002, answering questions: at the open after
 * a session's miss, the check found cell theory and prokaryotes, both missed, out of the plan while
 * a topic it ranked lower kept a lesson; only the database tier with questions showed it.
 */
describe("a plan short on time cuts the least asked topics first, with the learner's answers", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it(
    "ranks what the learner missed in an undone placement and in a session",
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
              undo: true,
            },
            { finish: 0, kind: "study", misses: [] },
            { finish: 0.25, kind: "study", misses: [1] },
            { kind: "refresh" },
          ],
          subscribed: false,
          targetInDays: 4,
        },
        { questions: true },
      );

      expect(violations.filter((violation) => violation.rule === "R11")).toStrictEqual([]);
    },
    5 * MINUTE,
  );

  // A class test four days away with its prokaryotes base as a quick lesson: after three missed
  // days, viruses, which placement missed, were set aside while the nucleus, which nobody missed,
  // kept its lesson. The plan following the one with every base's core carried its earlier days'
  // work in without ranking it.
  it(
    "ranks the work earlier days left when the plan studies a base another way",
    async () => {
      const { violations } = await runSimLifeInDb(
        {
          dailyMinutes: 45,
          fixture: "class-test",
          knownAreas: [],
          mockOffers: "skip",
          pending: [],
          proposals: "apply",
          seed: 2087,
          speed: 1,
          start: "2026-10-12",
          steps: [
            {
              answers: [
                [3, true],
                [1, false],
                [6, false],
                [1, true],
                [6, true],
                [4, false],
                [1, true],
                [3, true],
              ],
              kind: "placement",
            },
            { days: 3, kind: "miss" },
            { finish: 0.25, kind: "study", misses: [2] },
          ],
          subscribed: true,
          targetInDays: 4,
        },
        { questions: true },
      );

      expect(violations.filter((violation) => violation.rule === "R11")).toStrictEqual([]);
    },
    5 * MINUTE,
  );
});
