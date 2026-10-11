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

const UNDO_LIFE: SimLife = {
  dailyMinutes: 120,
  fixture: "enem",
  knownAreas: [],
  mockOffers: "focus",
  pending: [8, 15, 16, 42, 47, 50, 61, 71, 78, 81, 86, 95, 103, 104, 109, 112, 114, 133],
  proposals: "decline",
  seed: 2033,
  speed: 1.2,
  start: "2054-10-12",
  steps: [
    {
      answers: [
        [49, true],
        [123, false],
        [86, false],
        [123, false],
        [75, true],
        [79, true],
        [12, true],
        [36, false],
      ],
      kind: "placement",
    },
    { finish: 1, kind: "study", misses: [] },
    { finish: 1, kind: "study", misses: [] },
    { kind: "change", spec: { area: 1, kind: "focus", less: 4 }, via: "buddy" },
    { finish: 1, kind: "study", misses: [] },
    { finish: 0.25, kind: "study", misses: [] },
    { kind: "change", spec: { area: 2, kind: "pastBasics" }, via: "buddy" },
    { finish: 0.5, kind: "study", misses: [] },
    { finish: 0.25, kind: "study", misses: [] },
    { finish: 0, kind: "study", misses: [] },
    { days: 3, kind: "miss" },
    { kind: "change", spec: { area: 2, kind: "focus", less: 0 }, undo: true, via: "buddy" },
    { kind: "refresh" },
  ],
  subscribed: false,
  targetInDays: 50,
};

/*
 * R32 through the real capabilities, with ENEM learners answering questions: a system refresh with
 * nothing new right after a run that re-planned keeps the plan that run saved. Planned again in
 * another mode, an ENEM plan an undo gave back moved 70 items (see refresh-after-runs-db.test.ts
 * for the other exams').
 */
describe("an ENEM refresh with nothing new, through the real capabilities", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it(
    "keeps the ENEM plan an undo gave back",
    async () => {
      const { violations } = await runSimLifeInDb(UNDO_LIFE, { questions: true, rules: ["R32"] });

      expect(violations).toStrictEqual([]);
    },
    10 * MINUTE,
  );

  // The day's first open set ENEM work aside, then the learner asked for more explanation in
  // practice, which brought it back. A refresh with nothing new carried the morning's settled work
  // again and moved 227 items.
  it(
    "keeps an ENEM plan a change re-planned after the day's settle",
    async () => {
      const { violations } = await runSimLifeInDb(
        {
          dailyMinutes: 60,
          fixture: "enem",
          knownAreas: [0],
          pending: [14, 22, 24, 26, 30, 40, 44, 50, 53, 55, 69, 70, 86, 107, 123, 125],
          seed: 1261,
          speed: 0.8,
          start: "2054-10-12",
          steps: [
            { finish: 0.5, kind: "study", misses: [] },
            { finish: 1, kind: "study", misses: [] },
            { finish: 1, kind: "study", misses: [44] },
            { finish: 0, kind: "study", misses: [123] },
            { finish: 1, kind: "study", misses: [] },
            { finish: 0.25, kind: "study", misses: [110] },
            { kind: "change", spec: { area: 0, kind: "restore" }, via: "buddy" },
            { finish: 0.75, kind: "study", misses: [] },
            { finish: 0.5, kind: "study", misses: [105] },
            { kind: "change", spec: { bias: "moreExplanation", kind: "practice" }, via: "editor" },
            { kind: "refresh" },
          ],
          subscribed: false,
          targetInDays: 55,
        },
        { rules: ["R32"] },
      );

      expect(violations).toStrictEqual([]);
    },
    10 * MINUTE,
  );
});
