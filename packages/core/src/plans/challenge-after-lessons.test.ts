import { describe, expect, it } from "vitest";
import { type RuleContext } from "./_test-utils/rules/rule-context";
import { runSimLife } from "./_test-utils/sim/sim-life";
import { generateSimLife } from "./_test-utils/sim/sim-life-plan";
import { listCoreLessonItems } from "./_utils/core-lessons";

const MINUTE = 60_000;

/**
 * The lessons a phase's challenge tests: the core of each of its skills (their first lessons in
 * the plan, done ones included, as the planner counts them; see `listCoreLessonItems`), not the
 * depth a plan studies once every core is in.
 */
function listCoreLessons(plan: RuleContext["after"]) {
  const core = listCoreLessonItems({ graphSkills: plan.graph.skills, items: plan.items });
  return new Set([...core.values()].flat());
}

/**
 * After a missed day's settling, each phase's challenge still to do and the core lessons of its
 * own skills that come after it.
 */
function listChallengesBeforeLessons(context: RuleContext): string[] {
  const { after, event } = context;

  if (event.kind !== "newDay" || event.studied) {
    return [];
  }

  const phaseOf = new Map(after.graph.skills.map((skill) => [skill.skillId, skill.phase]));
  const core = listCoreLessons(after);

  return after.items.flatMap((boss) => {
    const day = boss.scheduledFor;

    if (boss.kind !== "boss" || boss.status !== "todo" || !day) {
      return [];
    }

    return after.items
      .filter(
        (item) =>
          core.has(item) &&
          item.status === "todo" &&
          item.scheduledFor !== null &&
          item.scheduledFor > day &&
          phaseOf.get(item.skillId ?? "") === boss.phase,
      )
      .map((item) => `phase ${boss.phase}: "${item.titleSnapshot}" after its challenge`);
  });
}

// A phase's challenge tests what its lessons teach. A missed day left a career phase's lessons
// and challenge undone, and the phases after it ended today and tomorrow: keeping those ends held
// the challenge today and moved its 13 lessons after it (career 1027). A missed day may move
// phase ends (R6), so the ends that would overlap move instead, as little as the lessons need.
describe("a phase's challenge after a missed day", () => {
  it(
    "comes after the lessons it tests, moving the later phase ends it would pass",
    async () => {
      const found: string[] = [];

      await runSimLife(
        {
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
            { finish: 1, kind: "study", misses: [9] },
          ],
          subscribed: false,
          targetInDays: 114,
        },
        {
          check: (context) => {
            found.push(...listChallengesBeforeLessons(context));
            return [];
          },
        },
      );

      expect(found).toStrictEqual([]);
    },
    5 * MINUTE,
  );
});

// A missed day's settling moved an ended phase's end to its carried lessons in the plan the run
// saved, while Today's proposal named that end from the day before the run. The next run read the
// proposal as not starting from the ends the learner sees and withdrew it, and phase 2's challenge
// stayed before three of its core lessons with no card (career 1160).
describe("today's proposal to move the phase dates", () => {
  it(
    "names each move from the end the plan it comes with shows",
    async () => {
      const { violations } = await runSimLife({
        dailyMinutes: 60,
        fixture: "career",
        knownAreas: [],
        pending: [],
        seed: 1160,
        speed: 1,
        start: "2026-10-12",
        steps: [
          { kind: "refresh" },
          { finish: 1, kind: "study", misses: [] },
          { finish: 1, kind: "study", misses: [0] },
          { finish: 1, kind: "study", misses: [] },
          { kind: "change", spec: { days: 7, kind: "date" }, via: "editor" },
          { finish: 0.75, kind: "study", misses: [] },
          { days: 3, kind: "miss" },
          { finish: 1, kind: "study", misses: [] },
        ],
        subscribed: false,
        targetInDays: 158,
      });

      expect(violations.filter((violation) => violation.rule === "R40")).toStrictEqual([]);
    },
    5 * MINUTE,
  );

  // The learner kept their dates ("Keep mine"), then missed days moved an end that card named.
  // The run judged the answer against the ends from before it, as if the learner still saw them,
  // so phase 3's challenge stayed before 6 of its core lessons with no card until a later run.
  it(
    "asks again once a run moves an end the learner kept",
    async () => {
      const life = await generateSimLife({ fixture: "career", seed: 1160 });
      const { violations } = await runSimLife(life);

      expect(violations.filter((violation) => violation.rule === "R40")).toStrictEqual([]);
    },
    5 * MINUTE,
  );
});
