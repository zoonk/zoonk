import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listNextDaySwaps } from "./_test-utils/next-day-swaps";
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
 * moved 500 items after a study day, an OAB plan 640 after the learner gave it more time, and an
 * ENEM plan an undo gave back moved 70.
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
    [
      "keeps the ENEM plan an undo gave back",
      {
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
      },
    ],
  ])(
    "%s",
    async (_name, life) => {
      const { violations } = await runSimLifeInDb(life, { questions: true });
      expect(violations.filter((violation) => violation.rule === "R32")).toStrictEqual([]);
    },
    10 * MINUTE,
  );

  // The day's first open set ENEM work aside, then the learner asked for more explanation in
  // practice, which brought it back. A refresh with nothing new carried the morning's settled work
  // again and moved 227 items.
  it(
    "keeps an ENEM plan a change re-planned after the day's settle",
    async () => {
      const { violations } = await runSimLifeInDb({
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
      });

      expect(violations.filter((violation) => violation.rule === "R32")).toStrictEqual([]);
    },
    10 * MINUTE,
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
        { questions: true },
      );

      expect(violations.filter((violation) => violation.rule === "R25")).toStrictEqual([]);
    },
    10 * MINUTE,
  );
});

/*
 * A session whose new pace no longer fits this week's work in it lays the rest out from the next
 * day, through the real capabilities: the next morning finds the plan the session's end saved.
 * Kept as it was, an OAB plan's next morning took 8 lessons out of the plan.
 */
describe("an exam plan the morning after a session, through the real capabilities", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it(
    "keeps an OAB plan as the session the day before left it",
    async () => {
      const result = await runSimLifeInDb(
        {
          dailyMinutes: 120,
          fixture: "oab",
          knownAreas: [15],
          pending: [0, 10, 15, 27, 34, 44, 55, 61, 64, 65, 66, 88, 93, 96, 97, 98],
          proposals: "apply",
          seed: 2003,
          speed: 0.8,
          start: "2054-10-12",
          steps: [
            {
              answers: [
                [42, false],
                [44, true],
                [46, true],
                [36, true],
                [64, true],
                [38, false],
                [98, false],
                [14, false],
              ],
              kind: "placement",
            },
            { kind: "change", spec: { area: 12, kind: "focus" }, via: "buddy" },
            { kind: "refresh" },
            { finish: 1, kind: "study", misses: [] },
            { count: 1, kind: "land" },
          ],
          subscribed: true,
          targetInDays: 107,
        },
        { trace: true },
      );

      expect(listNextDaySwaps(result)).toStrictEqual({ added: [], lost: [] });
    },
    10 * MINUTE,
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
        { questions: true },
      );

      expect(violations.filter((violation) => violation.rule === "R40")).toStrictEqual([]);
    },
    10 * MINUTE,
  );
});
