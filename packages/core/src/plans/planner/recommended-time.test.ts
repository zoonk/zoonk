import { describe, expect, it } from "vitest";
import { type BuildPlanInput, buildPlan } from "./build-plan";
import { withDailyMinutes } from "./daily-time-plans";
import { getPlanFeasibility } from "./plan-feasibility";
import { parsePlanSettings } from "./plan-state";

const SKILLS = 4;
const WRITTEN_LESSONS = 4;

/**
 * An exam nine days away studied on Sundays alone, whose four skills the graph sizes at one lesson
 * each while the Library wrote four lessons for each: more time a day adds a weekly mock
 * that takes a study day, so a longer day can hold fewer topics than a shorter one.
 */
function sundayExam(): BuildPlanInput {
  const skills = Array.from({ length: SKILLS }, (_, index) => ({
    area: `Area ${index % 3}`,
    lessons: 1,
    name: `Skill ${index}`,
    phase: 0,
    skillId: `s${index}`,
    weight: 1,
  }));

  return {
    goal: { dailyMinutes: 5, kind: "exam", targetDate: new Date("2020-10-07T00:00:00Z") },
    graph: { phases: [{ milestone: null, name: "Everything" }], skills },
    items: [],
    lessons: skills.flatMap((skill, index) =>
      Array.from({ length: WRITTEN_LESSONS }, (_, lesson) => ({
        chapterId: `c${index}`,
        lessonId: `s${index}l${lesson}`,
        /** Eight core lessons shed five minutes, offsetting the real text boss's extra five. */
        minutes: lesson < 2 ? 11.375 : 12,
        skillIds: [skill.skillId],
        title: `Lesson ${index}-${lesson}`,
      })),
    ),
    mockMinutes: 60,
    mode: "forced",
    paceFactor: 1,
    prerequisites: new Map(),
    readiness: new Map(),
    settings: parsePlanSettings({ startDate: "2020-09-28", weekdayMinutes: [5, 0, 0, 0, 0, 0, 0] }),
    today: new Date("2020-09-28T00:00:00Z"),
  };
}

const fitsAt = (input: BuildPlanInput, minutes: number) =>
  getPlanFeasibility({ input: withDailyMinutes(input, minutes) }).fits;

describe("the daily time a plan recommends", () => {
  it("is the fewest minutes that cover everything, even when a longer day covers less", () => {
    const input = sundayExam();
    const accepted = buildPlan(withDailyMinutes(input, 95));
    const at130 = buildPlan(withDailyMinutes(input, 130));

    const plannedSkills = new Set(
      accepted.items.filter((item) => item.kind === "lesson").flatMap((item) => item.skillId ?? []),
    );

    expect(input.graph.skills).toHaveLength(4);

    expect(
      input.graph.skills.map(
        (skill) => input.lessons.filter((row) => row.skillIds.includes(skill.skillId)).length,
      ),
    ).toStrictEqual([4, 4, 4, 4]);

    expect([...plannedSkills]).toStrictEqual(
      expect.arrayContaining(input.graph.skills.map((skill) => skill.skillId)),
    );

    expect(
      accepted.items.filter((item) => item.kind === "boss").map((item) => item.minutes),
    ).toStrictEqual([15, 15, 15]);

    expect(at130.mockFunding).toStrictEqual(
      expect.arrayContaining([expect.objectContaining({ date: "2020-10-04", minutes: 60 })]),
    );

    const earlierTimes = Array.from({ length: 18 }, (_, index) => (index + 1) * 5);
    expect(earlierTimes.some((minutes) => fitsAt(input, minutes))).toBe(false);

    // 95 to 110 minutes cover everything, 115 to 130 don't (a mock takes a day), 135 does again.
    // With the mock's day the only study day after them, the phases' challenges come right after
    // their lessons (see `placeExamBosses`).
    expect([90, 95, 110, 115, 130, 135].map((minutes) => fitsAt(input, minutes))).toStrictEqual([
      false,
      true,
      true,
      false,
      false,
      true,
    ]);

    expect(getPlanFeasibility({ input }).recommendedMinutes).toBe(95);
  });

  it("never takes a lower time that fits for the learner's own time covering everything", () => {
    // At 130 minutes a day the plan leaves topics out, though 95 covers them: their time isn't
    // enough, and the time that covers everything is the one that does, exactly as planned.
    const at130 = getPlanFeasibility({ input: withDailyMinutes(sundayExam(), 130) });

    expect(at130).toMatchObject({ fits: false, recommendedMinutes: 95, timeCovers: false });

    const at105 = getPlanFeasibility({ input: withDailyMinutes(sundayExam(), 105) });
    expect(at105).toMatchObject({ fits: true, recommendedMinutes: 95, timeCovers: true });
  });
});
