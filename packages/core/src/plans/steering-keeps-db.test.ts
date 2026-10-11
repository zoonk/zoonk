import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runSimLifeInDb } from "./_test-utils/sim/sim-db";
import { type SimLife } from "./_test-utils/sim/sim-life-plan";

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

/** Career seed 2107: Today offers to move the phase dates; the learner takes the buddy's focus. */
const LIFE_2107: SimLife = {
  dailyMinutes: 15,
  fixture: "career",
  knownAreas: [],
  mockOffers: "focus",
  pending: [4, 16, 25],
  seed: 2107,
  speed: 1.2,
  start: "2026-10-12",
  steps: [
    { finish: 1, kind: "study", misses: [] },
    { kind: "change", spec: { area: 2, kind: "focus" }, undo: true, via: "buddy" },
  ],
  subscribed: false,
  targetInDays: 103,
};

/*
 * R40, through the real capabilities with questions (sim N136, career 2107): the focus replaced
 * Today's card to move the phase dates and kept the dates, so the first phase's challenge stayed
 * before two of its lessons with no card. Moving them was planned with today's time open again,
 * fitted those lessons before the challenge on paper, and Today didn't ask.
 */
describe("a change of focus that keeps a challenge before its lessons", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it(
    "asks again to move the phase dates, planned as the change was",
    async () => {
      const { violations } = await runSimLifeInDb(LIFE_2107, { questions: true, rules: ["R40"] });

      expect(violations).toStrictEqual([]);
    },
    5 * MINUTE,
  );
});

/*
 * R40 through the real capabilities (sim N145, career 2131): a session's new pace laid the rest of
 * the week out from the next day, and Today's proposal to move the phase dates was planned again
 * from today, whose time was still open. There the lessons fit before their challenges with the
 * same ends, so the run withdrew the card and asked nothing, while the plan it saved held two
 * challenges before their lessons.
 */
describe("a session whose new pace lays the week out from the next day", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it(
    "asks to move the phase dates, planned from the next day as the session's run was",
    async () => {
      const { violations } = await runSimLifeInDb(
        {
          dailyMinutes: 15,
          fixture: "career",
          knownAreas: [],
          pending: [4, 6, 8, 11, 21, 22],
          seed: 2131,
          speed: 1.2,
          start: "2054-10-12",
          steps: [
            { finish: 0.75, kind: "study", misses: [] },
            { finish: 0.5, kind: "study", misses: [] },
            { count: 2, kind: "land" },
            { kind: "change", spec: { area: 2, kind: "focus" }, via: "buddy" },
            { finish: 1, kind: "study", misses: [23] },
            { finish: 0.25, kind: "study", misses: [] },
            { finish: 1, kind: "study", misses: [] },
            { finish: 1, kind: "study", misses: [] },
            { finish: 0, kind: "study", misses: [] },
            { finish: 0, kind: "study", misses: [] },
            { finish: 0.25, kind: "study", misses: [] },
            { finish: 1, kind: "study", misses: [0] },
            { kind: "change", spec: { inDays: 11, kind: "lightWeek" }, via: "editor" },
            { finish: 1, kind: "study", misses: [24] },
            { finish: 1, kind: "study", misses: [] },
            { finish: 1, kind: "study", misses: [24] },
          ],
          subscribed: false,
          targetInDays: null,
        },
        { questions: true, rules: ["R40"] },
      );

      expect(violations).toStrictEqual([]);
    },
    10 * MINUTE,
  );
});
