import { describe, expect, it } from "vitest";
import { runSimLife } from "./_test-utils/sim/sim-life";
import { type SimLife } from "./_test-utils/sim/sim-life-plan";

const MINUTE = 60_000;

async function findViolations({ life, rule }: { life: SimLife; rule: string }) {
  const { violations } = await runSimLife(life);
  return violations.filter((violation) => violation.rule === rule);
}

describe("a change of focus keeps today as the learner saw it", () => {
  // Career seed 1025: a focus with less of another area pushes a lesson the day showed to tomorrow.
  it(
    "keeps today's lessons when a focus changes a career plan",
    async () => {
      const life: SimLife = {
        dailyMinutes: 15,
        fixture: "career",
        knownAreas: [],
        pending: [],
        seed: 1025,
        speed: 1,
        start: "2026-10-12",
        steps: [
          { kind: "change", spec: { bias: "morePractice", kind: "practice" }, via: "editor" },
          { finish: 0.75, kind: "study", misses: [] },
          { kind: "change", spec: { area: 4, kind: "focus" }, via: "editor" },
          { finish: 1, kind: "study", misses: [] },
          { kind: "change", spec: { area: 4, kind: "focus", less: 3 }, via: "editor" },
        ],
        subscribed: false,
        targetInDays: 142,
      };

      await expect(findViolations({ life, rule: "R4" })).resolves.toStrictEqual([]);
    },
    5 * MINUTE,
  );

  // OAB seed 1004: after missed days, the buddy's "less" pushes today's last lesson to tomorrow.
  it(
    "keeps today's lessons when the buddy gives an area less time",
    async () => {
      const life: SimLife = {
        dailyMinutes: 60,
        fixture: "oab",
        knownAreas: [],
        pending: [],
        seed: 1004,
        speed: 0.8,
        start: "2026-10-12",
        steps: [
          { finish: 1, kind: "study", misses: [18] },
          { days: 3, kind: "miss" },
          { days: 3, kind: "miss" },
          { finish: 0.75, kind: "study", misses: [19] },
          { kind: "refresh" },
          { kind: "change", spec: { area: 6, kind: "reduce" }, via: "buddy" },
        ],
        subscribed: false,
        targetInDays: 113,
      };

      await expect(findViolations({ life, rule: "R4" })).resolves.toStrictEqual([]);
    },
    5 * MINUTE,
  );

  // OAB seed 1003: after a landing and missed days, "less" through the buddy pushes today's last
  // lesson to tomorrow.
  it(
    "keeps today's lessons after a landing and missed days",
    async () => {
      const life: SimLife = {
        dailyMinutes: 170,
        fixture: "oab",
        knownAreas: [],
        pending: [],
        seed: 1003,
        speed: 1,
        start: "2026-10-12",
        steps: [
          { finish: 0, kind: "study", misses: [73] },
          { finish: 0.75, kind: "study", misses: [] },
          { finish: 0.75, kind: "study", misses: [] },
          { finish: 0.75, kind: "study", misses: [] },
          { finish: 1, kind: "study", misses: [27] },
          { finish: 0.25, kind: "study", misses: [] },
          { days: 2, kind: "miss" },
          { finish: 0.75, kind: "study", misses: [] },
          { finish: 1, kind: "study", misses: [] },
          { finish: 0.25, kind: "study", misses: [] },
          { count: 1, kind: "land" },
          { days: 3, kind: "miss" },
          { finish: 1, kind: "study", misses: [] },
          { kind: "change", spec: { area: 4, kind: "reduce" }, via: "buddy" },
        ],
        subscribed: false,
        targetInDays: 92,
      };

      await expect(findViolations({ life, rule: "R4" })).resolves.toStrictEqual([]);
    },
    5 * MINUTE,
  );
});

describe("more of an area never gives it less", () => {
  // Career seed 1008: after three missed days, a focus on the portfolio ends it two days later with
  // as many lessons.
  it(
    "never ends a focused area later",
    async () => {
      const life: SimLife = {
        dailyMinutes: 45,
        fixture: "career",
        knownAreas: [],
        pending: [],
        seed: 1008,
        speed: 1,
        start: "2026-10-12",
        steps: [
          { days: 3, kind: "miss" },
          { finish: 1, kind: "study", misses: [26] },
          { kind: "change", spec: { area: 7, kind: "focus", less: 8 }, via: "editor" },
        ],
        subscribed: false,
        targetInDays: 104,
      };

      await expect(findViolations({ life, rule: "R1" })).resolves.toStrictEqual([]);
    },
    5 * MINUTE,
  );

  // Career seed 1057: more interaction design with less information architecture
  // started interaction design three weeks sooner but ended it three days later than the plan the
  // learner saw: its wireframes wait for a base in the area with less, and planned again from
  // today with today kept, the whole plan slid two days. The editor applied it; the buddy never
  // offers such a change.
  it(
    "never ends a focused area later than the plan the learner sees, with less of another",
    async () => {
      const life: SimLife = {
        dailyMinutes: 30,
        fixture: "career",
        knownAreas: [],
        pending: [3, 6, 9, 11, 12, 14, 20, 23],
        seed: 1057,
        speed: 1,
        start: "2026-10-12",
        steps: [
          { finish: 0.75, kind: "study", misses: [1] },
          { count: 1, kind: "land" },
          { kind: "change", spec: { area: 3, kind: "focus", less: 2 }, via: "editor" },
        ],
        subscribed: false,
        targetInDays: 169,
      };

      await expect(findViolations({ life, rule: "R1" })).resolves.toStrictEqual([]);
    },
    5 * MINUTE,
  );

  // OAB seed 1007: a focus on the bar's code of ethics left it with fewer lessons.
  it(
    "never leaves a focused exam area with fewer lessons",
    async () => {
      const life: SimLife = {
        dailyMinutes: 120,
        fixture: "oab",
        knownAreas: [],
        pending: [],
        seed: 1007,
        speed: 1,
        start: "2026-10-12",
        steps: [
          { finish: 0.25, kind: "study", misses: [60] },
          { kind: "change", spec: { area: 1, kind: "focus", less: 18 }, via: "editor" },
        ],
        subscribed: false,
        targetInDays: 68,
      };

      await expect(findViolations({ life, rule: "R1" })).resolves.toStrictEqual([]);
    },
    5 * MINUTE,
  );

  // Câmara seed 1007: a second focus left the focused area with fewer lessons.
  it(
    "never leaves the area of a second focus with fewer lessons",
    async () => {
      const life: SimLife = {
        dailyMinutes: 240,
        fixture: "camara",
        knownAreas: [],
        pending: [3, 4, 9, 20, 21, 24, 26, 28, 42, 58, 71, 73, 75, 85, 87, 92, 103, 104],
        seed: 1007,
        speed: 1,
        start: "2026-10-12",
        steps: [
          { kind: "change", spec: { area: 4, kind: "focus" }, via: "editor" },
          { days: 1, kind: "miss" },
          { kind: "change", spec: { area: 0, kind: "focus", less: 9 }, via: "editor" },
        ],
        subscribed: false,
        targetInDays: 51,
      };

      await expect(findViolations({ life, rule: "R1" })).resolves.toStrictEqual([]);
    },
    5 * MINUTE,
  );

  // ENEM, Ana's walk: with math focused, choosing math and natural sciences read "Nothing
  // changed", though natural sciences alone gained 10 lessons. Natural sciences gains, and math,
  // still focused, shares some of its depth with it.
  it(
    "gives an area added to the focus more lessons, shared with the area focused before",
    async () => {
      const life: SimLife = {
        dailyMinutes: 45,
        fixture: "enem",
        knownAreas: [],
        pending: [],
        seed: 1,
        speed: 1,
        start: "2026-10-12",
        steps: [
          { kind: "change", spec: { area: 1, kind: "focus" }, via: "editor" },
          { kind: "change", spec: { also: [0], area: 1, kind: "focus" }, via: "editor" },
        ],
        subscribed: true,
        targetInDays: 36,
      };

      const { events } = await runSimLife(life);
      const change = events.find((event) => event.step === 1)?.change;

      expect(change?.effect?.topicsAdded?.map((topic) => topic.area)).toContain(
        "Ciências da Natureza e suas Tecnologias",
      );

      // The card names the lessons the time comes from, math's among them.
      expect(change?.effect?.lessonsLeftOut?.length).toBeGreaterThan(0);
    },
    5 * MINUTE,
  );
});

describe("less of an area never ends it earlier or moves others unnamed", () => {
  // Career seed 1013: "more" of one area with less of another ended the reduced one a day earlier.
  it(
    "never ends a reduced career area earlier",
    async () => {
      const life: SimLife = {
        dailyMinutes: 60,
        fixture: "career",
        knownAreas: [],
        pending: [3, 8, 18, 20, 23, 24],
        seed: 1013,
        speed: 1,
        start: "2026-10-12",
        steps: [
          { finish: 1, kind: "study", misses: [] },
          { finish: 1, kind: "study", misses: [] },
          { finish: 1, kind: "study", misses: [] },
          { days: 1, kind: "miss" },
          { finish: 1, kind: "study", misses: [] },
          { days: 2, kind: "miss" },
          { kind: "change", spec: { base: 3, choice: "quick", kind: "bases" }, via: "buddy" },
          { finish: 0, kind: "study", misses: [] },
          { finish: 0.75, kind: "study", misses: [15] },
          { kind: "change", spec: { area: 8, kind: "focus", less: 5 }, via: "editor" },
        ],
        subscribed: false,
        targetInDays: 235,
      };

      await expect(findViolations({ life, rule: "R2" })).resolves.toStrictEqual([]);
    },
    5 * MINUTE,
  );

  // IELTS seed 1056: on day one, more reading with less writing kept every writing
  // lesson and moved its last one from Oct 18 to Oct 16, since planning again from today laid the
  // plan out tighter than the one the learner saw. The card said "Writing Oct 18 -> Oct 16".
  it(
    "never ends a reduced area sooner than the plan the learner sees when everything fits",
    async () => {
      const life: SimLife = {
        dailyMinutes: 20,
        fixture: "ielts",
        knownAreas: [],
        pending: [],
        seed: 1056,
        speed: 1,
        start: "2026-10-12",
        steps: [{ kind: "change", spec: { area: 1, kind: "focus", less: 2 }, via: "editor" }],
        subscribed: false,
        targetInDays: 37,
      };

      await expect(findViolations({ life, rule: "R2" })).resolves.toStrictEqual([]);
    },
    5 * MINUTE,
  );

  // Language seed 1030: "less" of the only area after a refresh pulled its end two months earlier.
  it(
    "never pulls the only area's end earlier",
    async () => {
      const life: SimLife = {
        dailyMinutes: 45,
        fixture: "language",
        knownAreas: [],
        pending: [],
        seed: 1030,
        speed: 1,
        start: "2026-10-12",
        steps: [
          { finish: 0.25, kind: "study", misses: [] },
          { kind: "refresh" },
          { finish: 0, kind: "study", misses: [] },
          { kind: "change", spec: { area: 0, kind: "reduce" }, via: "editor" },
        ],
        subscribed: false,
        targetInDays: null,
      };

      await expect(findViolations({ life, rule: "R2" })).resolves.toStrictEqual([]);
    },
    5 * MINUTE,
  );

  // OAB seed 1007: a focus with "less" of another area moved criminal procedure, which it doesn't
  // name, from 40 to 44 lessons and two days earlier, and the card said nothing.
  it(
    "names on the card an area a focus with less moves by more than rounding",
    async () => {
      const life: SimLife = {
        dailyMinutes: 120,
        fixture: "oab",
        knownAreas: [],
        pending: [],
        seed: 1007,
        speed: 1,
        start: "2026-10-12",
        steps: [
          {
            answers: [
              [33, true],
              [94, true],
              [107, false],
              [21, false],
            ],
            kind: "placement",
          },
          { finish: 0.5, kind: "study", misses: [] },
          { kind: "change", spec: { area: 1, kind: "focus", less: 18 }, via: "editor" },
        ],
        subscribed: false,
        targetInDays: 68,
      };

      await expect(findViolations({ life, rule: "R2" })).resolves.toStrictEqual([]);
    },
    5 * MINUTE,
  );

  // OAB seed 1002: after landings, "less" of one area moved another the card doesn't name.
  it(
    "moves no area a reduction doesn't name on OAB",
    async () => {
      const life: SimLife = {
        dailyMinutes: 60,
        fixture: "oab",
        knownAreas: [],
        pending: [
          0, 8, 15, 27, 33, 42, 44, 47, 48, 49, 57, 58, 62, 64, 76, 79, 81, 87, 90, 97, 98, 100,
          102, 105,
        ],
        seed: 1002,
        speed: 1,
        start: "2026-10-12",
        steps: [
          { finish: 1, kind: "study", misses: [] },
          { finish: 1, kind: "study", misses: [] },
          { finish: 1, kind: "study", misses: [61] },
          { finish: 0.5, kind: "study", misses: [] },
          { count: 3, kind: "land" },
          { finish: 0.75, kind: "study", misses: [103] },
          { kind: "change", spec: { area: 5, kind: "reduce" }, via: "editor" },
        ],
        subscribed: false,
        targetInDays: 72,
      };

      await expect(findViolations({ life, rule: "R2" })).resolves.toStrictEqual([]);
    },
    5 * MINUTE,
  );

  // Câmara seed 1001: "less" of one area moved another the card doesn't name.
  it(
    "moves no area a reduction doesn't name on Câmara",
    async () => {
      const life: SimLife = {
        dailyMinutes: 120,
        fixture: "camara",
        knownAreas: [],
        pending: [9, 11, 18, 19, 21, 26, 47, 60, 76, 79, 82, 84, 86, 99, 103, 105, 107, 108],
        seed: 1001,
        speed: 1,
        start: "2026-10-12",
        steps: [
          {
            answers: [
              [79, false],
              [19, true],
              [79, true],
              [77, false],
              [114, false],
              [40, true],
            ],
            kind: "placement",
          },
          { finish: 0.5, kind: "study", misses: [] },
          { kind: "change", spec: { area: 8, kind: "restore" }, via: "buddy" },
          { finish: 0, kind: "study", misses: [] },
          { kind: "change", spec: { area: 5, kind: "reduce" }, via: "editor" },
        ],
        subscribed: false,
        targetInDays: 104,
      };

      await expect(findViolations({ life, rule: "R2" })).resolves.toStrictEqual([]);
    },
    5 * MINUTE,
  );

  // Câmara seed 1002: the buddy's "less" of one area put other chapters' lessons ahead of the
  // rest of the chapter in progress.
  it(
    "keeps the chapter in progress next when the buddy gives an area less time",
    async () => {
      const life: SimLife = {
        dailyMinutes: 60,
        fixture: "camara",
        knownAreas: [],
        mockOffers: "skip",
        pending: [
          0, 8, 15, 27, 33, 42, 44, 47, 48, 49, 57, 58, 62, 64, 76, 79, 81, 87, 90, 97, 98, 100,
          102, 105, 109,
        ],
        seed: 1002,
        speed: 0.8,
        start: "2026-10-12",
        steps: [
          {
            answers: [
              [24, true],
              [43, false],
              [9, false],
              [33, true],
              [69, false],
              [87, true],
              [31, true],
            ],
            kind: "placement",
            undo: true,
          },
          { finish: 0.5, kind: "study", misses: [] },
          { kind: "change", spec: { area: 3, kind: "reduce" }, via: "buddy" },
        ],
        subscribed: false,
        targetInDays: 55,
      };

      await expect(findViolations({ life, rule: "R10" })).resolves.toStrictEqual([]);
    },
    5 * MINUTE,
  );

  // Career seed 1254: skipping the portfolio made the problem-definition skill a base, whose core
  // cut the last lessons and the challenge of the chapter the learner was in.
  it(
    "keeps the rest of the chapter in progress when skipping another area makes its skill a base",
    async () => {
      const life: SimLife = {
        dailyMinutes: 15,
        fixture: "career",
        knownAreas: [],
        pending: [],
        seed: 1254,
        speed: 1,
        start: "2026-10-12",
        steps: [
          { finish: 0.5, kind: "study", misses: [24] },
          { days: 3, kind: "miss" },
          { kind: "refresh" },
          { count: 2, kind: "land" },
          { kind: "change", spec: { area: 7, kind: "skip" }, via: "editor" },
        ],
        subscribed: false,
        targetInDays: 199,
      };

      await expect(findViolations({ life, rule: "R10" })).resolves.toStrictEqual([]);
    },
    5 * MINUTE,
  );
});
