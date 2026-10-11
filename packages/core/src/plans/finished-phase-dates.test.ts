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

/*
 * R6: a phase the learner saw keeps its end through a system run. Sims N25 and N26, through the
 * real capabilities with questions: in-session answers tested out a phase's lessons, and the
 * lessons an earlier phase's slower pace or a half-studied day left after its challenge all went
 * to that finished phase, which ended later with each of them.
 */
describe("a phase a test-out finished", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each<[string, SimLife]>([
    [
      "a career plan's after a session sets a slower pace",
      {
        dailyMinutes: 15,
        fixture: "career",
        knownAreas: [],
        mockOffers: "skip",
        pending: [9, 11, 18, 19, 21, 26],
        proposals: "decline",
        seed: 1001,
        speed: 1.2,
        start: "2026-10-12",
        steps: [
          { kind: "change", spec: { area: 6, kind: "reduce" }, via: "buddy" },
          { kind: "change", spec: { base: 1, choice: "essential", kind: "bases" }, via: "editor" },
          { finish: 1, kind: "study", misses: [] },
          { kind: "refresh" },
          { finish: 0.75, kind: "study", misses: [] },
          { finish: 1, kind: "study", misses: [] },
        ],
        subscribed: false,
        targetInDays: null,
      },
    ],
    [
      "a language plan's after a half-studied day",
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
    ],
  ])(
    "keeps the end of every phase ahead in %s",
    async (_name, life) => {
      const { violations } = await runSimLifeInDb(life, { questions: true });

      expect(violations.filter((violation) => violation.rule === "R6")).toStrictEqual([]);
    },
    5 * MINUTE,
  );
});
