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
 * R32 through the real capabilities, with the learner answering questions: a system refresh with
 * nothing new right after a run that re-planned keeps the plan that run saved. Each life starts in
 * 2054, so other files' lessons can't change its pace. Planned again in another mode, a Câmara plan
 * moved 500 items after a study day and an OAB plan 640 after the learner gave it more time (see
 * refresh-after-runs-enem-db.test.ts for ENEM's).
 */
describe("a refresh with nothing new, through the real capabilities", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each<[string, SimLife]>([
    [
      "keeps a Câmara plan right after placement and after a study day",
      {
        dailyMinutes: 60,
        fixture: "camara",
        knownAreas: [2],
        mockOffers: "skip",
        pending: [0, 10, 15, 27, 34, 44, 55, 61, 64, 65, 66, 88, 93, 96, 97, 98, 113],
        proposals: "apply",
        seed: 2003,
        speed: 1.5,
        start: "2054-10-12",
        steps: [
          {
            answers: [
              [41, false],
              [107, false],
              [15, false],
              [12, false],
              [67, true],
              [7, false],
            ],
            kind: "placement",
          },
          { kind: "refresh" },
          { kind: "refresh" },
          { finish: 1, kind: "study", misses: [73] },
          { finish: 0.75, kind: "study", misses: [77] },
          { kind: "refresh" },
        ],
        subscribed: false,
        targetInDays: 84,
      },
    ],
    [
      "keeps a Câmara plan the day's session re-planned after missed days",
      {
        dailyMinutes: 120,
        fixture: "camara",
        knownAreas: [7],
        mockOffers: "skip",
        pending: [0, 23, 26, 34, 38, 45, 60, 89, 97, 110],
        proposals: "decline",
        seed: 2001,
        speed: 1.5,
        start: "2054-10-12",
        steps: [
          {
            answers: [
              [116, false],
              [106, false],
              [29, false],
              [42, true],
              [13, false],
            ],
            kind: "placement",
          },
          { kind: "change", spec: { inDays: 7, kind: "lightWeek" }, via: "editor" },
          { kind: "change", spec: { area: 5, kind: "focus" }, via: "editor" },
          { kind: "change", spec: { kind: "restDay", weekday: 3 }, undo: true, via: "buddy" },
          { days: 2, kind: "miss" },
          { finish: 1, kind: "study", misses: [] },
          { kind: "refresh" },
          { finish: 0.25, kind: "study", misses: [] },
        ],
        subscribed: false,
        targetInDays: 112,
      },
    ],
    [
      "keeps an OAB plan right after the learner gave it more time",
      {
        dailyMinutes: 60,
        fixture: "oab",
        knownAreas: [],
        mockOffers: "focus",
        pending: [0, 6, 17, 22, 29, 31, 33, 49, 52, 55, 57, 59, 76, 88, 94, 98],
        proposals: "apply",
        seed: 2014,
        speed: 1,
        start: "2054-10-12",
        steps: [
          { kind: "refresh" },
          { finish: 1, kind: "study", misses: [] },
          { kind: "change", spec: { area: 7, kind: "focus" }, via: "buddy" },
          { kind: "change", spec: { kind: "restDay", weekday: 5 }, via: "editor" },
          { finish: 0.75, kind: "study", misses: [] },
          { finish: 0, kind: "study", misses: [59] },
          { finish: 0, kind: "study", misses: [58] },
          { count: 2, kind: "land" },
          { finish: 0, kind: "study", misses: [] },
          { finish: 0.75, kind: "study", misses: [] },
          { finish: 1, kind: "study", misses: [] },
          { kind: "change", spec: { inDays: 17, kind: "lightWeek" }, via: "editor" },
          { finish: 0.5, kind: "study", misses: [] },
          { finish: 1, kind: "study", misses: [] },
          { kind: "change", spec: { kind: "time", minutes: 180 }, via: "editor" },
          { kind: "refresh" },
        ],
        subscribed: true,
        targetInDays: 112,
      },
    ],
    [
      "keeps a career plan without a date on a refresh after a missed day",
      {
        dailyMinutes: 45,
        fixture: "career",
        knownAreas: [],
        mockOffers: "skip",
        pending: [8, 15, 16],
        proposals: "decline",
        seed: 2033,
        speed: 1.5,
        start: "2054-10-12",
        steps: [
          { count: 3, kind: "land" },
          { finish: 0.25, kind: "study", misses: [] },
          { days: 2, kind: "miss" },
          { kind: "change", spec: { area: 5, kind: "restore" }, via: "editor" },
          { finish: 0, kind: "study", misses: [21] },
          { finish: 0.25, kind: "study", misses: [] },
          { finish: 0, kind: "study", misses: [] },
          { finish: 0.25, kind: "study", misses: [] },
          { finish: 0.25, kind: "study", misses: [] },
          { finish: 0.75, kind: "study", misses: [] },
          { kind: "change", spec: { days: -7, kind: "date" }, via: "buddy" },
          { finish: 0.5, kind: "study", misses: [] },
          { finish: 0.25, kind: "study", misses: [] },
          { finish: 0.75, kind: "study", misses: [] },
          { kind: "refresh" },
          { days: 1, kind: "miss" },
          { kind: "refresh" },
        ],
        subscribed: false,
        targetInDays: null,
      },
    ],
  ])(
    "%s",
    async (_name, life) => {
      const { violations } = await runSimLifeInDb(life, { questions: true, rules: ["R32"] });
      expect(violations).toStrictEqual([]);
    },
    10 * MINUTE,
  );
});
