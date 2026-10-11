import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runSimLifeInDb } from "./_test-utils/sim/sim-db";
import { type SimLife, generateSimLife } from "./_test-utils/sim/sim-life-plan";

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

/** Career seed 2049: tested out on 10-14, confirmed on 10-17, missed in practice on 10-25. */
const LIFE_2049: SimLife = {
  dailyMinutes: 60,
  fixture: "career",
  knownAreas: [],
  pending: [1, 5, 13, 15, 21, 22, 24],
  seed: 2049,
  speed: 1,
  start: "2026-10-12",
  steps: [
    { days: 2, kind: "miss" },
    { finish: 0.75, kind: "study", misses: [9] },
    { finish: 0.75, kind: "study", misses: [] },
    { finish: 0.5, kind: "study", misses: [] },
    { finish: 1, kind: "study", misses: [] },
    { finish: 0, kind: "study", misses: [] },
    { days: 1, kind: "miss" },
    { kind: "refresh" },
    { finish: 0.75, kind: "study", misses: [] },
    { finish: 0.5, kind: "study", misses: [] },
    { finish: 0.25, kind: "study", misses: [] },
    { days: 2, kind: "miss" },
    { finish: 0.75, kind: "study", misses: [0] },
  ],
  subscribed: true,
  targetInDays: 164,
};

/*
 * R5: a topic that comes into the plan is named by the run that brought it in. Sim N13 (OAB seed
 * 1002, through the real capabilities): a practice miss on a topic taken as known planned the plan
 * again from today, which also brought in the legislative process and juvenile offense topics,
 * and its card named only the missed topic.
 */
describe("a miss that brings a known topic's lessons back", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it(
    "names every topic the plan planned again brings in, not only the missed one",
    async () => {
      const life = await generateSimLife({ fixture: "oab", seed: 1002 });

      const { violations } = await runSimLifeInDb(
        { ...life, steps: life.steps.slice(0, 7) },
        { questions: true },
      );

      expect(violations.filter((violation) => violation.rule === "R5")).toStrictEqual([]);
    },
    10 * MINUTE,
  );

  // R19: practice missed a topic the learner tested out of and confirmed, and the relearn named
  // it with none of its lessons back (career seed 2049): the lessons still tested out read the
  // skill as settled, and counted toward its core, so the ones that came back left the plan.
  it(
    "brings back the lessons of a topic practice missed after a test-out it confirmed",
    async () => {
      const { violations } = await runSimLifeInDb(LIFE_2049, { questions: true });

      expect(violations.filter((violation) => violation.rule === "R19")).toStrictEqual([]);
    },
    10 * MINUTE,
  );

  // R19: on a day that carried missed work, a test-out answer brought a tested-out topic back and
  // named it, and the same step's re-plan for the lessons it skipped dropped the topic's lessons
  // again: ranked behind the carried work before the class test (class test seed 2080).
  it(
    "keeps the lessons a miss brought back on later runs that day",
    async () => {
      const life = await generateSimLife({ fixture: "class-test", seed: 2080 });

      const { violations } = await runSimLifeInDb(
        { ...life, steps: life.steps.slice(0, 10) },
        { questions: true },
      );

      expect(violations.filter((violation) => violation.rule === "R19")).toStrictEqual([]);
    },
    10 * MINUTE,
  );
});
