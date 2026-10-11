import { describe, expect, it } from "vitest";
import { runSimLife } from "./_test-utils/sim/sim-life";
import { type SimLife } from "./_test-utils/sim/sim-life-plan";

const MINUTE = 60_000;

async function findRefreshMoves(life: SimLife) {
  const { violations } = await runSimLife(life);
  return violations.filter((violation) => violation.rule === "R32");
}

// A system refresh with nothing new (another goal's lessons landed, the lookahead ran) right after a
// run that re-planned the day keeps the plan that run saved. Planned again in another mode, an OAB
// plan made on day one moved 600 items (see landing-after-runs.test.ts) and an ENEM focus lost 21
// lessons with nothing new.
describe("a refresh right after a learner's change", () => {
  it(
    "keeps an ENEM plan a focus re-planned after a half-studied day",
    async () => {
      const moves = await findRefreshMoves({
        dailyMinutes: 60,
        fixture: "enem",
        knownAreas: [3],
        mockOffers: "skip",
        pending: [0, 23, 26, 34, 38, 45, 60, 89, 97, 110, 118, 128],
        proposals: "decline",
        seed: 2001,
        speed: 1.5,
        start: "2026-10-12",
        steps: [
          {
            answers: [
              [100, true],
              [133, true],
              [112, false],
              [104, true],
              [46, false],
              [58, true],
              [81, false],
              [34, true],
              [113, false],
              [52, false],
              [97, true],
              [90, true],
            ],
            kind: "placement",
          },
          { finish: 0.5, kind: "study", misses: [5] },
          { kind: "change", spec: { area: 5, kind: "focus" }, via: "editor" },
          { kind: "refresh" },
        ],
        subscribed: false,
        targetInDays: 57,
      });

      expect(moves).toStrictEqual([]);
    },
    MINUTE,
  );

  it(
    "keeps a career plan a focus gave today's leftover time to",
    async () => {
      const moves = await findRefreshMoves({
        dailyMinutes: 30,
        fixture: "career",
        knownAreas: [],
        pending: [],
        seed: 1042,
        speed: 1.5,
        start: "2026-10-12",
        steps: [
          { finish: 0.75, kind: "study", misses: [] },
          { finish: 1, kind: "study", misses: [] },
          { days: 1, kind: "miss" },
          { finish: 0.5, kind: "study", misses: [11] },
          { kind: "change", spec: { days: 14, kind: "date" }, via: "buddy" },
          { count: 1, kind: "land" },
          { finish: 0.5, kind: "study", misses: [24] },
          { kind: "change", spec: { kind: "time", minutes: 180 }, via: "editor" },
          { finish: 0.75, kind: "study", misses: [20] },
          { kind: "change", spec: { area: 8, kind: "focus", less: 5 }, via: "buddy" },
          { kind: "refresh" },
        ],
        subscribed: false,
        targetInDays: 221,
      });

      expect(moves).toStrictEqual([]);
    },
    MINUTE,
  );

  // An ENEM plan 55 days out at an hour a day: the day's first open set work aside, then the
  // learner asked for more explanation in practice, which brought that work back. A refresh with
  // nothing new carried the morning's settled work again: 227 items moved, and lessons the change
  // had brought back were set aside again without a card.
  it(
    "keeps an ENEM plan a change re-planned after the day's settle",
    async () => {
      const moves = await findRefreshMoves({
        dailyMinutes: 60,
        fixture: "enem",
        knownAreas: [0],
        pending: [14, 22, 24, 26, 30, 40, 44, 50, 53, 55, 69, 70, 86, 107, 123, 125],
        seed: 1261,
        speed: 0.8,
        start: "2026-10-12",
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

      expect(moves).toStrictEqual([]);
    },
    MINUTE,
  );
});

describe("a refresh right after the day's settle", () => {
  it(
    "keeps a career plan settled after a quarter-studied day at less time",
    async () => {
      const moves = await findRefreshMoves({
        dailyMinutes: 60,
        fixture: "career",
        knownAreas: [],
        pending: [],
        seed: 1018,
        speed: 1.2,
        start: "2026-10-12",
        steps: [
          { finish: 1, kind: "study", misses: [] },
          { finish: 1, kind: "study", misses: [] },
          { finish: 0.75, kind: "study", misses: [] },
          { finish: 1, kind: "study", misses: [26] },
          { kind: "change", spec: { kind: "time", minutes: 15 }, via: "buddy" },
          { finish: 0.25, kind: "study", misses: [] },
          { kind: "refresh" },
        ],
        subscribed: false,
        targetInDays: 105,
      });

      expect(moves).toStrictEqual([]);
    },
    MINUTE,
  );

  it(
    "keeps an ENEM plan settled after four missed days",
    async () => {
      const moves = await findRefreshMoves({
        dailyMinutes: 120,
        fixture: "enem",
        knownAreas: [0],
        pending: [
          5, 10, 12, 21, 36, 37, 62, 71, 72, 75, 87, 95, 97, 100, 103, 111, 117, 123, 127, 131,
        ],
        seed: 2012,
        speed: 1,
        start: "2026-10-12",
        steps: [
          {
            answers: [
              [25, true],
              [133, false],
              [44, false],
              [131, true],
              [134, false],
              [4, false],
              [5, true],
            ],
            kind: "placement",
          },
          { finish: 1, kind: "study", misses: [] },
          { kind: "change", spec: { kind: "restDay", weekday: 5 }, via: "buddy" },
          { finish: 0.25, kind: "study", misses: [70] },
          { finish: 0.75, kind: "study", misses: [] },
          { days: 2, kind: "miss" },
          { count: 1, kind: "land" },
          { finish: 0, kind: "study", misses: [70] },
          { finish: 0.5, kind: "study", misses: [] },
          { finish: 0.25, kind: "study", misses: [] },
          { days: 3, kind: "miss" },
          { days: 1, kind: "miss" },
          { kind: "refresh" },
        ],
        subscribed: false,
        targetInDays: 32,
      });

      expect(moves).toStrictEqual([]);
    },
    MINUTE,
  );
});

describe("a refresh right after an undo", () => {
  it(
    "keeps the ENEM plan the undo gave back",
    async () => {
      const moves = await findRefreshMoves({
        dailyMinutes: 120,
        fixture: "enem",
        knownAreas: [],
        mockOffers: "focus",
        pending: [8, 15, 16, 42, 47, 50, 61, 71, 78, 81, 86, 95, 103, 104, 109, 112, 114, 133],
        proposals: "decline",
        seed: 2033,
        speed: 1.2,
        start: "2026-10-12",
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
      });

      expect(moves).toStrictEqual([]);
    },
    MINUTE,
  );
});
