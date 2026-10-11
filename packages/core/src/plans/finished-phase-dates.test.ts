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
 * R6: a phase the learner saw keeps its end through a system run. Sim N26, through the real
 * capabilities with questions: in-session answers tested out a phase's lessons, and the lessons a
 * half-studied day left after an earlier phase's challenge all went to that finished phase, which
 * ended later with each of them. Sim N25's career plan, whose slower pace did the same, is
 * `placeItemsInPhaseTime`'s (`planner/phase-time.test.ts`).
 */
describe("a phase a test-out finished", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it(
    "keeps the end of every phase ahead in a language plan's after a half-studied day",
    async () => {
      const { violations } = await runSimLifeInDb(
        {
          dailyMinutes: 45,
          fixture: "language",
          knownAreas: [],
          pending: [],
          proposals: "apply",
          seed: 1008,
          speed: 1,
          start: "2026-10-12",
          steps: [
            { finish: 0.75, kind: "study", misses: [] },
            { kind: "refresh" },
            { finish: 1, kind: "study", misses: [] },
            { finish: 1, kind: "study", misses: [] },
            { finish: 1, kind: "study", misses: [] },
            { kind: "change", spec: { base: 3, choice: "skip", kind: "bases" }, via: "editor" },
            { kind: "change", spec: { kind: "time", minutes: 180 }, via: "buddy" },
            { finish: 1, kind: "study", misses: [] },
            { kind: "change", spec: { area: 0, kind: "focus" }, via: "buddy" },
            { finish: 0.5, kind: "study", misses: [] },
            { kind: "change", spec: { area: 0, kind: "focus" }, via: "editor" },
            { kind: "change", spec: { area: 0, kind: "focus" }, undo: true, via: "editor" },
            { count: 3, kind: "land" },
            { finish: 0.75, kind: "study", misses: [] },
            { kind: "refresh" },
            { days: 3, kind: "miss" },
            { finish: 0.25, kind: "study", misses: [] },
            { finish: 1, kind: "study", misses: [] },
          ],
          subscribed: true,
          targetInDays: 73,
        },
        { questions: true, rules: ["R6"] },
      );

      expect(violations).toStrictEqual([]);
    },
    5 * MINUTE,
  );
});
