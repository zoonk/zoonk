import { describe, expect, it } from "vitest";
import { runSimLife } from "./_test-utils/sim/sim-life";
import { type SimLife } from "./_test-utils/sim/sim-life-plan";

const MINUTE = 60_000;

async function findViolations(life: SimLife) {
  const { violations } = await runSimLife(life);
  return violations.filter((violation) => violation.rule === "R16");
}

// R16: what a skill builds on comes first, whatever planned its lessons: a chapter two skills
// share, the chapter the learner is in, or lessons the Library outlined since.
describe("a skill's lessons and what it builds on", () => {
  it(
    "keeps a shared chapter's wireframe lessons after the content structure a less sent later",
    async () => {
      const violations = await findViolations({
        dailyMinutes: 30,
        fixture: "career",
        knownAreas: [],
        pending: [],
        seed: 1000,
        speed: 1,
        start: "2026-10-12",
        steps: [{ kind: "change", spec: { area: 2, kind: "reduce" }, via: "editor" }],
        subscribed: false,
        targetInDays: 167,
      });

      expect(violations).toStrictEqual([]);
    },
    5 * MINUTE,
  );

  it(
    "keeps the chapter in progress's lesson of a later situation after the one it builds on",
    async () => {
      const violations = await findViolations({
        dailyMinutes: 15,
        fixture: "language",
        knownAreas: [],
        pending: [],
        seed: 1001,
        speed: 1,
        start: "2026-10-12",
        steps: [
          { finish: 0.75, kind: "study", misses: [5] },
          { finish: 0.5, kind: "study", misses: [] },
          { finish: 1, kind: "study", misses: [] },
        ],
        subscribed: false,
        targetInDays: null,
      });

      expect(violations).toStrictEqual([]);
    },
    5 * MINUTE,
  );

  it(
    "lands a stand-in's lessons on its own day, never before the base its skill builds on",
    async () => {
      const violations = await findViolations({
        dailyMinutes: 120,
        fixture: "oab",
        knownAreas: [],
        pending: [],
        seed: 1001,
        speed: 1,
        start: "2026-10-12",
        steps: [
          {
            answers: [
              [106, true],
              [39, false],
              [100, true],
              [96, false],
              [28, true],
              [72, false],
              [17, true],
              [72, true],
              [70, false],
              [105, false],
            ],
            kind: "placement",
          },
          { finish: 0, kind: "study", misses: [] },
          { finish: 0.5, kind: "study", misses: [] },
          { kind: "change", spec: { area: 6, kind: "focus" }, via: "buddy" },
          { days: 1, kind: "miss" },
          { days: 2, kind: "miss" },
          { finish: 0, kind: "study", misses: [] },
          { kind: "change", spec: { area: 9, kind: "reduce" }, via: "editor" },
          { finish: 1, kind: "study", misses: [] },
          { finish: 0.75, kind: "study", misses: [] },
          { finish: 0.25, kind: "study", misses: [] },
        ],
        subscribed: true,
        targetInDays: 131,
      });

      expect(violations).toStrictEqual([]);
    },
    5 * MINUTE,
  );

  // A focus gives what's left of today to the focused area's next lessons. A career's content
  // structure for interfaces came today, two days before the information architecture it builds
  // on, which isn't focused.
  it(
    "gives today a focused lesson only after what its skill builds on",
    async () => {
      const violations = await findViolations({
        dailyMinutes: 60,
        fixture: "career",
        knownAreas: [],
        pending: [],
        seed: 1002,
        speed: 1,
        start: "2026-10-12",
        steps: [
          { count: 1, kind: "land" },
          { finish: 0.5, kind: "study", misses: [] },
          { kind: "change", spec: { area: 2, kind: "focus" }, via: "buddy" },
        ],
        subscribed: false,
        targetInDays: 90,
      });

      expect(violations).toStrictEqual([]);
    },
    5 * MINUTE,
  );

  // What earlier days left comes first, as it was planned. A lesson ENEM's Linguagens shares with
  // the skill it teaches, given on a day the learner didn't study, came back before the quick
  // lesson of the base that skill builds on, which the Library wrote since.
  it(
    "carries a lesson an earlier day left after the base its skill builds on",
    async () => {
      const violations = await findViolations({
        dailyMinutes: 180,
        fixture: "enem",
        knownAreas: [],
        pending: [
          7, 18, 26, 28, 38, 48, 51, 62, 66, 69, 75, 84, 88, 90, 94, 103, 109, 113, 118, 120, 129,
          130,
        ],
        seed: 1000,
        speed: 1,
        start: "2026-10-12",
        steps: [
          { finish: 0, kind: "study", misses: [50] },
          { finish: 0.75, kind: "study", misses: [38] },
        ],
        subscribed: false,
        targetInDays: 47,
      });

      expect(violations).toStrictEqual([]);
    },
    5 * MINUTE,
  );

  // A Câmara plan's study cycle gives a day a lesson even when none of its subjects can go on. The
  // buddy's "less Língua Portuguesa" left such a day where another subject could, and the lesson it
  // gave was a skill whose base, in another subject, hadn't started.
  it(
    "gives a day where its own subjects wait a lesson whose base has started",
    async () => {
      const violations = await findViolations({
        dailyMinutes: 60,
        fixture: "camara",
        knownAreas: [1],
        mockOffers: "focus",
        pending: [7, 16, 20, 22, 26, 33, 37, 50, 53, 63, 64, 66, 85, 86, 87, 91, 108, 113, 116],
        proposals: "apply",
        seed: 2005,
        speed: 1.5,
        start: "2026-10-12",
        steps: [
          {
            answers: [
              [70, false],
              [73, true],
              [41, true],
              [107, false],
              [54, false],
              [16, true],
              [26, false],
              [32, false],
              [89, false],
              [113, true],
              [104, true],
              [70, true],
            ],
            kind: "placement",
          },
          { kind: "change", spec: { area: 2, kind: "reduce" }, via: "buddy" },
        ],
        subscribed: false,
        targetInDays: 57,
      });

      expect(violations).toStrictEqual([]);
    },
    5 * MINUTE,
  );
});
