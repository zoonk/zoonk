import { describe, expect, it } from "vitest";
import { runSimLife } from "./_test-utils/sim/sim-life";
import { type SimLife } from "./_test-utils/sim/sim-life-plan";

const MINUTE = 60_000;

async function findR24(life: SimLife) {
  const { violations } = await runSimLife(life);
  return violations.filter((violation) => violation.rule === "R24");
}

describe("an exam plan keeps a mock in every long phase", () => {
  // OAB at 170 minutes a day: after a landing and missed days, the foundations phase still spans
  // 14 days or more but holds no mock.
  it(
    "keeps a mock in the foundations after a landing and missed days",
    async () => {
      const violations = await findR24({
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
          { finish: 0.75, kind: "study", misses: [] },
          { count: 1, kind: "land" },
          { days: 3, kind: "miss" },
          { days: 3, kind: "miss" },
          { finish: 1, kind: "study", misses: [] },
          { finish: 1, kind: "study", misses: [90] },
          { days: 1, kind: "miss" },
          { finish: 0, kind: "study", misses: [] },
        ],
        subscribed: false,
        targetInDays: 92,
      });

      expect(violations).toStrictEqual([]);
    },
    10 * MINUTE,
  );

  // Câmara: a time cut to 15 minutes, sessions and missed days, then the learner restores an
  // area: the foundations phase spans 14 days or more with no mock in it.
  it(
    "keeps a mock in the foundations after a time cut and missed days",
    async () => {
      const violations = await findR24({
        dailyMinutes: 180,
        fixture: "camara",
        knownAreas: [],
        pending: [],
        seed: 1003,
        speed: 1,
        start: "2026-10-12",
        steps: [
          { days: 3, kind: "miss" },
          { finish: 0, kind: "study", misses: [] },
          { kind: "change", spec: { kind: "time", minutes: 15 }, via: "buddy" },
          { finish: 1, kind: "study", misses: [98] },
          { days: 1, kind: "miss" },
          { finish: 0, kind: "study", misses: [] },
          { finish: 0.25, kind: "study", misses: [96] },
          { finish: 0.5, kind: "study", misses: [] },
          { finish: 0.5, kind: "study", misses: [] },
          { finish: 1, kind: "study", misses: [] },
          { days: 3, kind: "miss" },
          { kind: "change", spec: { area: 0, kind: "restore" }, via: "buddy" },
        ],
        subscribed: false,
        targetInDays: 72,
      });

      expect(violations).toStrictEqual([]);
    },
    10 * MINUTE,
  );

  // A class test 12 days away: the learner misses the days around the plan's one mock and comes
  // back two days before the test; the settle moved the lessons and dropped the mock.
  it(
    "plans a missed class test mock again when the learner comes back before the test",
    async () => {
      const violations = await findR24({
        dailyMinutes: 20,
        fixture: "class-test",
        knownAreas: [],
        pending: [],
        seed: 1016,
        speed: 1,
        start: "2026-10-12",
        steps: [
          { finish: 1, kind: "study", misses: [] },
          { finish: 0.75, kind: "study", misses: [6] },
          { finish: 0.5, kind: "study", misses: [] },
          { finish: 0.75, kind: "study", misses: [] },
          { days: 1, kind: "miss" },
          { finish: 0, kind: "study", misses: [] },
          { days: 3, kind: "miss" },
          { finish: 0.5, kind: "study", misses: [1] },
          { kind: "refresh" },
        ],
        subscribed: false,
        targetInDays: 12,
      });

      expect(violations).toStrictEqual([]);
    },
    MINUTE,
  );

  // A class test 8 days away: the learner misses three days, restores an area through the buddy
  // and studies on; the plan's next run on 10-19 keeps no mock before the test.
  it(
    "keeps a class test mock after missed days and a restored area",
    async () => {
      const violations = await findR24({
        dailyMinutes: 30,
        fixture: "class-test",
        knownAreas: [],
        pending: [],
        seed: 1017,
        speed: 1,
        start: "2026-10-12",
        steps: [
          { finish: 1, kind: "study", misses: [3] },
          { finish: 0.25, kind: "study", misses: [1] },
          { finish: 0.25, kind: "study", misses: [] },
          { days: 3, kind: "miss" },
          { kind: "change", spec: { area: 0, kind: "restore" }, via: "buddy" },
          { finish: 1, kind: "study", misses: [3] },
          { finish: 0.25, kind: "study", misses: [] },
        ],
        subscribed: false,
        targetInDays: 8,
      });

      expect(violations).toStrictEqual([]);
    },
    MINUTE,
  );

  // A class test two weeks away at 15 minutes a day (r11, B7-3): the learner missed the week's
  // mock, and the buddy's focus planned it again on the last lesson day, where its 30 minutes
  // pushed the rest of the chapter in progress out. It goes on the day before, with the review.
  it(
    "plans a missed class test mock again on the day before, not on a lesson day",
    async () => {
      const { plans, violations } = await runSimLife(
        {
          dailyMinutes: 15,
          fixture: "class-test",
          knownAreas: [],
          pending: [2, 4, 5],
          seed: 1030,
          speed: 1,
          start: "2026-10-12",
          steps: [
            { days: 3, kind: "miss" },
            { finish: 1, kind: "study", misses: [] },
            { days: 1, kind: "miss" },
            { finish: 0.25, kind: "study", misses: [] },
            { finish: 1, kind: "study", misses: [] },
            { kind: "change", spec: { area: 0, kind: "focus" }, via: "buddy" },
          ],
          subscribed: false,
          targetInDays: 14,
        },
        { trace: true },
      );

      const mocks = (plans.at(-1)?.items ?? []).filter(
        (item) => item.kind === "mock" && item.status === "todo",
      );

      expect(mocks.map((item) => item.scheduledFor?.toISOString().slice(0, 10))).toStrictEqual([
        "2026-10-25",
      ]);

      // R10: the focus keeps the chapter in progress whole (its last lesson left with the phase
      // challenge alone on 10-20, B7-3).
      expect(
        violations.filter((violation) => violation.rule === "R24" || violation.rule === "R10"),
      ).toStrictEqual([]);
    },
    MINUTE,
  );
});
