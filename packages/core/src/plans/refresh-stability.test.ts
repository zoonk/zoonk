import { describe, expect, it } from "vitest";
import { runSimLife } from "./_test-utils/sim/sim-life";
import { type SimLife } from "./_test-utils/sim/sim-life-plan";

const MINUTE = 60_000;

async function findViolations({ life, rule }: { life: SimLife; rule: string }) {
  const { violations } = await runSimLife(life);
  return violations.filter((violation) => violation.rule === rule);
}

// A base studied for its core has nothing left in the plan once its core is done. Read as a
// finished skill, the next run planned it whole and the one after for its core again, so every run
// moved its last lessons in and out and re-dated what came after them.
describe("a base whose core the learner finished", () => {
  it(
    "keeps a career plan as it is on the next open of Today",
    async () => {
      const violations = await findViolations({
        life: {
          dailyMinutes: 15,
          fixture: "career",
          knownAreas: [],
          pending: [1, 2, 3, 24],
          seed: 1012,
          speed: 1,
          start: "2026-10-12",
          steps: [
            { kind: "change", spec: { area: 7, kind: "skip" }, via: "editor" },
            { finish: 1, kind: "study", misses: [] },
            { days: 1, kind: "miss" },
            { finish: 1, kind: "study", misses: [24] },
          ],
          subscribed: false,
          targetInDays: 206,
        },
        rule: "R32",
      });

      expect(violations).toStrictEqual([]);
    },
    MINUTE,
  );

  it(
    "keeps a class test's plan as it is on a refresh after the day's settle",
    async () => {
      const violations = await findViolations({
        life: {
          dailyMinutes: 15,
          fixture: "class-test",
          knownAreas: [],
          pending: [],
          seed: 1000,
          speed: 1,
          start: "2026-10-12",
          steps: [
            {
              answers: [
                [4, false],
                [1, false],
                [4, true],
                [1, true],
                [2, true],
                [1, true],
                [4, true],
                [3, false],
                [4, true],
                [6, true],
                [5, true],
                [2, true],
              ],
              kind: "placement",
            },
            { finish: 1, kind: "study", misses: [] },
            { finish: 0.5, kind: "study", misses: [] },
            { finish: 0.25, kind: "study", misses: [2] },
            { kind: "refresh" },
          ],
          subscribed: false,
          targetInDays: 10,
        },
        rule: "R32",
      });

      expect(violations).toStrictEqual([]);
    },
    MINUTE,
  );

  it(
    "keeps a lesson an earlier day left when missed days settle",
    async () => {
      const violations = await findViolations({
        life: {
          dailyMinutes: 30,
          fixture: "class-test",
          knownAreas: [],
          pending: [],
          seed: 1017,
          speed: 1,
          start: "2026-10-12",
          steps: [
            {
              answers: [
                [3, true],
                [0, false],
                [2, true],
                [0, true],
                [3, true],
                [3, false],
              ],
              kind: "placement",
            },
            { finish: 0.25, kind: "study", misses: [1] },
            { finish: 0.25, kind: "study", misses: [] },
            { days: 3, kind: "miss" },
            { kind: "change", spec: { area: 0, kind: "restore" }, via: "buddy" },
          ],
          subscribed: false,
          targetInDays: 8,
        },
        rule: "R8",
      });

      expect(violations).toStrictEqual([]);
    },
    MINUTE,
  );
});

// A day's session gives lessons due later once its own are done. Left for the next day, they
// filled the day a phase the learner saw ends on, and its challenge moved a day later though the
// learner had studied.
describe("the day after a day the learner studied", () => {
  it(
    "keeps a career plan's phase end when what the day left fills it",
    async () => {
      const violations = await findViolations({
        life: {
          dailyMinutes: 60,
          fixture: "career",
          knownAreas: [],
          pending: [],
          seed: 1003,
          speed: 1,
          start: "2026-10-12",
          steps: [
            { finish: 0.75, kind: "study", misses: [] },
            { finish: 1, kind: "study", misses: [10] },
            { kind: "change", spec: { area: 6, kind: "focus", less: 4 }, via: "editor" },
            { days: 1, kind: "miss" },
            { finish: 1, kind: "study", misses: [] },
            { days: 3, kind: "miss" },
            { finish: 1, kind: "study", misses: [] },
          ],
          subscribed: false,
          targetInDays: 236,
        },
        rule: "R6",
      });

      expect(violations).toStrictEqual([]);
    },
    MINUTE,
  );

  it(
    "keeps a language plan's phase end when what the day left fills it",
    async () => {
      const violations = await findViolations({
        life: {
          dailyMinutes: 45,
          fixture: "language",
          knownAreas: [],
          pending: [],
          seed: 1003,
          speed: 1,
          start: "2026-10-12",
          steps: [
            { finish: 0.25, kind: "study", misses: [] },
            { finish: 0.5, kind: "study", misses: [] },
          ],
          subscribed: false,
          targetInDays: 196,
        },
        rule: "R6",
      });

      expect(violations).toStrictEqual([]);
    },
    MINUTE,
  );

  // A half-studied day is a studied day: the challenge it left comes first the next day, and the
  // next phase's challenge still closes that phase on the day the learner saw, its lessons giving
  // way. Kept after them instead, a career's second phase ended two days later.
  it(
    "keeps a career plan's phase end when a half-studied day left the phase before's challenge",
    async () => {
      const violations = await findViolations({
        life: {
          dailyMinutes: 60,
          fixture: "career",
          knownAreas: [],
          pending: [],
          seed: 1016,
          speed: 1,
          start: "2026-10-12",
          steps: [
            { finish: 0.25, kind: "study", misses: [2] },
            { finish: 1, kind: "study", misses: [] },
            { finish: 0, kind: "study", misses: [] },
            { finish: 0.5, kind: "study", misses: [] },
            { finish: 0.75, kind: "study", misses: [] },
            { days: 1, kind: "miss" },
            { finish: 0, kind: "study", misses: [] },
            { days: 3, kind: "miss" },
            { finish: 0.5, kind: "study", misses: [7] },
            { finish: 1, kind: "study", misses: [] },
            { finish: 1, kind: "study", misses: [17] },
            { finish: 0.5, kind: "study", misses: [] },
            { finish: 0.5, kind: "study", misses: [] },
            { kind: "refresh" },
          ],
          subscribed: false,
          targetInDays: null,
        },
        rule: "R6",
      });

      expect(violations).toStrictEqual([]);
    },
    MINUTE,
  );

  // A career short on time leaves phases out to keep its job search whole. Kept on their days, the
  // phase ends held the job search past its date, so the settle moved them instead.
  it(
    "keeps a career plan's phase ends and its job search when its time is short",
    async () => {
      const { violations } = await runSimLife({
        dailyMinutes: 60,
        fixture: "career",
        knownAreas: [],
        pending: [],
        seed: 1002,
        speed: 1,
        start: "2026-10-12",
        steps: [
          { kind: "change", spec: { area: 3, kind: "reduce" }, via: "buddy" },
          { finish: 0.5, kind: "study", misses: [] },
          { days: 2, kind: "miss" },
          { finish: 0.25, kind: "study", misses: [] },
          { kind: "change", spec: { kind: "time", minutes: 15 }, via: "buddy" },
          { finish: 0.75, kind: "study", misses: [] },
          { finish: 0.25, kind: "study", misses: [] },
          { finish: 0.75, kind: "study", misses: [] },
        ],
        subscribed: false,
        targetInDays: 90,
      });

      expect(
        violations.filter((violation) => ["R6", "R13"].includes(violation.rule)),
      ).toStrictEqual([]);
    },
    MINUTE,
  );
});

// A goal whose graph maps no topics records the skills a system run brings in or leaves out, as
// a notice's topics are: a language plan's refresh at the learner's own pace left a situation out
// with nothing said, and a career plan's case study looked like it left once its lessons landed.
describe("a system run on a goal without notice topics", () => {
  it(
    "says when a refresh at the learner's pace leaves a skill out",
    async () => {
      const violations = await findViolations({
        life: {
          dailyMinutes: 45,
          fixture: "language",
          knownAreas: [],
          pending: [8, 9, 11, 14],
          seed: 1033,
          speed: 1.5,
          start: "2026-10-12",
          steps: [
            { finish: 0.75, kind: "study", misses: [] },
            { finish: 0.5, kind: "study", misses: [] },
            { days: 2, kind: "miss" },
            { finish: 0.75, kind: "study", misses: [] },
            { finish: 0, kind: "study", misses: [11] },
            { finish: 0.5, kind: "study", misses: [] },
          ],
          subscribed: false,
          targetInDays: 122,
        },
        rule: "R5",
      });

      expect(violations).toStrictEqual([]);
    },
    MINUTE,
  );

  it(
    "keeps a skill whose lessons landed in a chapter it shares",
    async () => {
      const violations = await findViolations({
        life: {
          dailyMinutes: 30,
          fixture: "career",
          knownAreas: [],
          pending: [6, 17, 25],
          seed: 1000,
          speed: 1,
          start: "2026-10-12",
          steps: [
            { kind: "change", spec: { area: 2, kind: "reduce" }, via: "editor" },
            { finish: 1, kind: "study", misses: [] },
            { count: 3, kind: "land" },
          ],
          subscribed: false,
          targetInDays: 167,
        },
        rule: "R5",
      });

      expect(violations).toStrictEqual([]);
    },
    MINUTE,
  );
});

// Laid out in the queue's order, the first open of Today after the day's settling moved an OAB
// plan's lessons a day and swapped the last ones at its date.
describe("a later run on the day earlier days' work settled", () => {
  it(
    "keeps the plan as the settling laid it out",
    async () => {
      const violations = await findViolations({
        life: {
          dailyMinutes: 60,
          fixture: "oab",
          knownAreas: [],
          pending: [],
          seed: 1000,
          speed: 1,
          start: "2026-10-12",
          steps: [
            { finish: 0.25, kind: "study", misses: [39] },
            { finish: 1, kind: "study", misses: [14] },
          ],
          subscribed: false,
          targetInDays: 115,
        },
        rule: "R32",
      });

      expect(violations).toStrictEqual([]);
    },
    MINUTE,
  );

  // A plan short on time had no room for a phase's challenge, so the phase ended on its weekly
  // challenge's day; kept as if its challenge were there, each run brought it in or left it out.
  it(
    "keeps a phase without room for its challenge as it is",
    async () => {
      const violations = await findViolations({
        life: {
          dailyMinutes: 25,
          fixture: "language",
          knownAreas: [],
          pending: [],
          seed: 1002,
          speed: 1,
          start: "2026-10-12",
          steps: [
            { finish: 0, kind: "study", misses: [] },
            { finish: 0.25, kind: "study", misses: [2] },
            { finish: 1, kind: "study", misses: [] },
            { kind: "change", spec: { area: 0, kind: "reduce" }, via: "buddy" },
            { finish: 0.5, kind: "study", misses: [] },
            { days: 2, kind: "miss" },
            { finish: 1, kind: "study", misses: [13] },
            { finish: 0.25, kind: "study", misses: [] },
            { kind: "change", spec: { kind: "time", minutes: 15 }, via: "buddy" },
            { finish: 0.75, kind: "study", misses: [] },
            { finish: 0.25, kind: "study", misses: [] },
            { finish: 0.75, kind: "study", misses: [] },
            { finish: 0, kind: "study", misses: [9] },
            { finish: 0.25, kind: "study", misses: [] },
          ],
          subscribed: false,
          targetInDays: 60,
        },
        rule: "R32",
      });

      expect(violations).toStrictEqual([]);
    },
    MINUTE,
  );
});

// Five missed days before a class test left no time for a topic whose lessons weren't written yet:
// the settling deleted it, though the learner never got to it.
describe("missed days that leave no time for earlier days' work", () => {
  it(
    "sets it aside, named, instead of deleting it",
    async () => {
      const violations = await findViolations({
        life: {
          dailyMinutes: 15,
          fixture: "class-test",
          knownAreas: [],
          pending: [3, 5],
          seed: 6,
          speed: 1.2,
          start: "2026-10-12",
          steps: [
            {
              answers: [
                [4, false],
                [6, false],
                [1, false],
              ],
              kind: "placement",
            },
            { days: 2, kind: "miss" },
            { days: 3, kind: "miss" },
            { kind: "refresh" },
            { finish: 1, kind: "study", misses: [0] },
            { finish: 0.75, kind: "study", misses: [2] },
            { kind: "change", spec: { area: 0, kind: "restore" }, via: "editor" },
            { finish: 1, kind: "study", misses: [] },
          ],
          subscribed: true,
          targetInDays: 12,
        },
        rule: "R8",
      });

      expect(violations).toStrictEqual([]);
    },
    MINUTE,
  );

  // Two missed days before a class test set organelles aside. The learner then chose to study
  // everything, which goes on after the test, and organelles stayed out.
  it(
    "brings it back once the learner chooses to study everything",
    async () => {
      const violations = await findViolations({
        life: {
          dailyMinutes: 20,
          fixture: "class-test",
          knownAreas: [],
          pending: [4],
          seed: 1236,
          speed: 1,
          start: "2026-10-12",
          steps: [
            { finish: 0, kind: "study", misses: [] },
            { days: 2, kind: "miss" },
            { kind: "change", spec: { kind: "fullCourse", on: true }, via: "editor" },
          ],
          subscribed: false,
          targetInDays: 5,
        },
        rule: "R14",
      });

      expect(violations).toStrictEqual([]);
    },
    MINUTE,
  );
});

// Opening the app again with nothing new re-planned the whole plan: a planning run on its own
// output doesn't always lay it out the same way, so a later open the same day added, lost or moved
// lessons the learner had just seen. Building a day only settles what earlier days left.
describe("opening Today again with nothing new", () => {
  it.each<[string, SimLife]>([
    [
      "a career plan after a day's settling",
      {
        dailyMinutes: 60,
        fixture: "career",
        knownAreas: [],
        pending: [],
        seed: 1016,
        speed: 1,
        start: "2026-10-12",
        steps: [
          { count: 3, kind: "land" },
          { finish: 0.25, kind: "study", misses: [2] },
          { finish: 1, kind: "study", misses: [] },
          { finish: 0, kind: "study", misses: [] },
          { finish: 0.5, kind: "study", misses: [] },
          { finish: 0.75, kind: "study", misses: [] },
          { days: 1, kind: "miss" },
          { finish: 0, kind: "study", misses: [] },
          { days: 3, kind: "miss" },
          { finish: 0.5, kind: "study", misses: [7] },
          { finish: 1, kind: "study", misses: [] },
          { finish: 1, kind: "study", misses: [17] },
          { finish: 0.5, kind: "study", misses: [] },
          { finish: 0.5, kind: "study", misses: [] },
          { kind: "refresh" },
        ],
        subscribed: false,
        targetInDays: null,
      },
    ],
    [
      "a language plan after a day's settling",
      {
        dailyMinutes: 25,
        fixture: "language",
        knownAreas: [],
        pending: [6, 7, 8, 10],
        seed: 1015,
        speed: 1,
        start: "2026-10-12",
        steps: [
          { finish: 1, kind: "study", misses: [] },
          { days: 3, kind: "miss" },
          { kind: "change", spec: { bias: "morePractice", kind: "practice" }, via: "buddy" },
          { finish: 0, kind: "study", misses: [2] },
          { finish: 0.25, kind: "study", misses: [] },
          { days: 1, kind: "miss" },
          { finish: 0.5, kind: "study", misses: [] },
          { finish: 0, kind: "study", misses: [] },
          { finish: 1, kind: "study", misses: [9] },
          { kind: "change", spec: { area: 0, kind: "focus" }, via: "buddy" },
        ],
        subscribed: false,
        targetInDays: 133,
      },
    ],
  ])(
    "keeps %s as it is",
    async (_name, life) => {
      const violations = await findViolations({ life, rule: "R32" });

      expect(violations).toStrictEqual([]);
    },
    MINUTE,
  );
});

// A plan whose base is studied with its quick lesson follows the order of the plan with the base's
// core (see `followLearnedOrder`). On an automatic run that plan took the base's core for new work
// this week, so it laid itself out from the week after behind time it didn't need: the refresh
// right after a class test's new date lost six lessons, and one a day after a Câmara session
// moved 111.
describe("a refresh of a plan with a quick lesson", () => {
  it.each<[string, SimLife]>([
    [
      "a class test's plan right after a new test date",
      {
        dailyMinutes: 15,
        fixture: "class-test",
        knownAreas: [],
        pending: [],
        seed: 1019,
        speed: 1,
        start: "2026-10-12",
        steps: [
          { kind: "change", spec: { days: 14, kind: "date" }, via: "buddy" },
          { kind: "refresh" },
        ],
        subscribed: false,
        targetInDays: 4,
      },
    ],
    [
      "a Câmara plan the day after a session",
      {
        dailyMinutes: 60,
        fixture: "camara",
        knownAreas: [],
        pending: [],
        seed: 1002,
        speed: 1,
        start: "2026-10-12",
        steps: [
          { finish: 0.5, kind: "study", misses: [] },
          { finish: 0.75, kind: "study", misses: [113] },
          { finish: 1, kind: "study", misses: [] },
          { finish: 1, kind: "study", misses: [38] },
          { finish: 0.5, kind: "study", misses: [] },
          { finish: 0.25, kind: "study", misses: [11] },
          { finish: 1, kind: "study", misses: [57] },
          { kind: "refresh" },
        ],
        subscribed: false,
        targetInDays: 55,
      },
    ],
  ])(
    "keeps %s as it is",
    async (_name, life) => {
      const violations = await findViolations({ life, rule: "R32" });

      expect(violations).toStrictEqual([]);
    },
    MINUTE,
  );
});

// An automatic run that would date new work this week lays the rest out from the week after,
// after the time this week's work takes past it. Read from the run's own layout, which put this
// week's work in another order, that time was a stand-in and a lesson more than the saved plan
// had, and an IELTS refresh moved the next three stand-ins a day.
describe("a refresh when this week's last stand-in runs past it", () => {
  it(
    "keeps an IELTS plan as it is",
    async () => {
      const violations = await findViolations({
        life: {
          dailyMinutes: 20,
          fixture: "ielts",
          knownAreas: [1],
          pending: [],
          seed: 1001,
          speed: 1,
          start: "2026-10-12",
          steps: [
            { finish: 0.75, kind: "study", misses: [3] },
            { kind: "change", spec: { area: 1, kind: "focus" }, via: "editor" },
            { count: 2, kind: "land" },
            { finish: 1, kind: "study", misses: [] },
            { kind: "refresh" },
          ],
          subscribed: false,
          targetInDays: 75,
        },
        rule: "R32",
      });

      expect(violations).toStrictEqual([]);
    },
    MINUTE,
  );
});

// A stand-in this week whose skill's lessons the Library wrote since gives its place to them. An
// ENEM skill sharing written lessons with another skill, which the plan counts for that one, read
// as written since on every automatic run: the refresh after a day's settling moved its stand-in
// past this week and left lessons out.
describe("a refresh with a stand-in whose skill shares written lessons", () => {
  it(
    "keeps an ENEM plan as the day's settling left it",
    async () => {
      const violations = await findViolations({
        life: {
          dailyMinutes: 60,
          fixture: "enem",
          knownAreas: [],
          pending: [9, 11, 18, 19, 21, 26, 47, 60, 76, 79, 82, 84, 86, 99, 103, 105, 107, 108],
          proposals: "decline",
          seed: 1001,
          speed: 1,
          start: "2026-10-12",
          steps: [
            {
              answers: [
                [107, true],
                [119, true],
                [102, true],
                [88, true],
                [76, true],
                [48, false],
                [81, false],
                [62, true],
                [48, false],
              ],
              kind: "placement",
            },
            { finish: 0.25, kind: "study", misses: [] },
            { finish: 0.75, kind: "study", misses: [1] },
            { kind: "change", spec: { kind: "restDay", weekday: 3 }, via: "editor" },
            { days: 3, kind: "miss" },
            { kind: "change", spec: { area: 2, kind: "restore" }, via: "buddy" },
            { finish: 0, kind: "study", misses: [95] },
            { finish: 1, kind: "study", misses: [] },
            { finish: 1, kind: "study", misses: [] },
            { days: 2, kind: "miss" },
            { finish: 0.25, kind: "study", misses: [] },
            { finish: 0.5, kind: "study", misses: [85] },
            { kind: "change", spec: { area: 3, kind: "reduce" }, via: "buddy" },
            { kind: "change", spec: { area: 0, kind: "restore" }, undo: true, via: "buddy" },
            { finish: 0.25, kind: "study", misses: [] },
            { finish: 1, kind: "study", misses: [] },
            { finish: 1, kind: "study", misses: [78] },
            { kind: "refresh" },
          ],
          subscribed: false,
          targetInDays: 53,
        },
        rule: "R32",
      });

      expect(violations).toStrictEqual([]);
    },
    MINUTE,
  );
});

// A stand-in this week stays as it is on an automatic run, but the part of it a plan short on time
// cuts is still cut. Hidden with the stand-in, its cut read as all of it in the plan: after "less
// American English", the refresh saved a language plan's stand-in at 96 lessons instead of 32 and
// moved everything after it two weeks later.
describe("a refresh with a stand-in this week that the time cut in part", () => {
  it(
    "keeps a language plan as the change left it",
    async () => {
      const violations = await findViolations({
        life: {
          dailyMinutes: 45,
          fixture: "language",
          knownAreas: [],
          pending: [2, 4, 6, 8, 9, 12],
          seed: 1022,
          speed: 1,
          start: "2026-10-12",
          steps: [
            { days: 3, kind: "miss" },
            { finish: 0.5, kind: "study", misses: [] },
            { finish: 0.75, kind: "study", misses: [] },
            { finish: 1, kind: "study", misses: [7] },
            { finish: 0, kind: "study", misses: [] },
            { count: 1, kind: "land" },
            { finish: 0.5, kind: "study", misses: [2] },
            { finish: 0, kind: "study", misses: [] },
            { finish: 0.75, kind: "study", misses: [] },
            { kind: "change", spec: { kind: "fullCourse", on: true }, via: "editor" },
            { finish: 1, kind: "study", misses: [4] },
            { finish: 0.5, kind: "study", misses: [14] },
            { finish: 0.5, kind: "study", misses: [] },
            { finish: 1, kind: "study", misses: [8] },
            { kind: "change", spec: { area: 0, kind: "reduce" }, via: "editor" },
            { kind: "refresh" },
          ],
          subscribed: false,
          targetInDays: 114,
        },
        rule: "R32",
      });

      expect(violations).toStrictEqual([]);
    },
    MINUTE,
  );
});

// An automatic run keeps this week's lessons on their days, and the plan's practice days start
// after the last of them. Read from the run's own copies of that work, a career's last lessons,
// kept on Sunday, ended on Monday, and the refresh took Monday's practice day out of the plan.
describe("a refresh when the plan's last lessons are this week", () => {
  it(
    "keeps a career plan's first practice day",
    async () => {
      const violations = await findViolations({
        life: {
          dailyMinutes: 30,
          fixture: "career",
          knownAreas: [],
          pending: [2, 8, 13, 14, 18, 25, 26],
          seed: 1027,
          speed: 1,
          start: "2026-10-12",
          steps: [
            { kind: "change", spec: { kind: "time", minutes: 180 }, via: "editor" },
            { days: 2, kind: "miss" },
            { finish: 1, kind: "study", misses: [25] },
            { finish: 0.25, kind: "study", misses: [] },
            { finish: 0.75, kind: "study", misses: [] },
            { finish: 0.75, kind: "study", misses: [] },
            { finish: 1, kind: "study", misses: [] },
            { finish: 1, kind: "study", misses: [] },
            { days: 3, kind: "miss" },
            { finish: 1, kind: "study", misses: [17] },
            { finish: 1, kind: "study", misses: [] },
            { finish: 1, kind: "study", misses: [] },
            { finish: 1, kind: "study", misses: [] },
            { finish: 0.25, kind: "study", misses: [12] },
            { kind: "refresh" },
          ],
          subscribed: false,
          targetInDays: 114,
        },
        rule: "R32",
      });

      expect(violations).toStrictEqual([]);
    },
    MINUTE,
  );
});
