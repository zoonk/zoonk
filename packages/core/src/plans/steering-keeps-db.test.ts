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

/** ENEM seed 2083: on 10-22, the day after an essay lesson, the learner asks for less essay. */
const LIFE_2083: SimLife = {
  dailyMinutes: 60,
  fixture: "enem",
  knownAreas: [],
  mockOffers: "focus",
  pending: [
    0, 2, 12, 22, 23, 29, 48, 52, 55, 60, 61, 66, 67, 70, 71, 75, 77, 84, 89, 99, 105, 112, 118,
    126, 129,
  ],
  proposals: "decline",
  seed: 2083,
  speed: 1.2,
  start: "2026-10-12",
  steps: [
    { finish: 0.25, kind: "study", misses: [62] },
    { finish: 1, kind: "study", misses: [41] },
    { finish: 0, kind: "study", misses: [108] },
    { finish: 0.5, kind: "study", misses: [53] },
    { finish: 0, kind: "study", misses: [] },
    { days: 3, kind: "miss" },
    { finish: 0.5, kind: "study", misses: [] },
    { kind: "change", spec: { area: 0, kind: "focus", less: 5 }, via: "editor" },
    { finish: 0.5, kind: "study", misses: [78] },
    { kind: "change", spec: { kind: "time", minutes: 45 }, via: "buddy" },
    { kind: "change", spec: { area: 4, kind: "reduce" }, via: "editor" },
  ],
  subscribed: true,
  targetInDays: 52,
};

/*
 * R10, through the real capabilities with questions (sim N120, ENEM 2083): the essay's chapter in
 * progress had its next lesson today, and "less essay" took it out of today's session and put it
 * two days later, behind physics. The learner finishes the chapter they're in before less of its
 * subject applies.
 */
describe("less of the subject of the chapter in progress", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it(
    "keeps the chapter's next lesson on the day the learner saw it",
    async () => {
      const { violations } = await runSimLifeInDb(LIFE_2083, { questions: true });

      expect(violations.filter((violation) => violation.rule === "R10")).toStrictEqual([]);
    },
    5 * MINUTE,
  );
});

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
      const { violations } = await runSimLifeInDb(LIFE_2107, { questions: true });

      expect(violations.filter((violation) => violation.rule === "R40")).toStrictEqual([]);
    },
    5 * MINUTE,
  );
});
