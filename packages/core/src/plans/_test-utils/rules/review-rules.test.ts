import { describe, expect, it } from "vitest";
import { checkFinishedLessonsComeBack } from "./review-rules";
import { type RuleContext } from "./rule-context";
import { ruleContext, ruleDay, ruleLesson, rulePlan, ruleSkill } from "./rule-fixtures";

const skills = [
  ruleSkill({ area: "Usability", skillId: "usability" }),
  ruleSkill({ area: "Research", skillId: "research" }),
];

const plan = rulePlan({
  items: [
    ruleLesson({ completedAt: ruleDay(0), day: 0, skillId: "usability", status: "done" }),
    ruleLesson({ day: 1, skillId: "research" }),
  ],
  skills,
});

/**
 * The learner finished a usability lesson on day 0 that trained a finer skill of its own; its end
 * screen said it comes back on day 2.
 */
const finished: NonNullable<RuleContext["finishedLessons"]> = [
  {
    comesBackOn: ruleDay(2),
    day: ruleDay(0),
    lessonId: "usability-0",
    skillIds: ["usability", "run-a-test"],
  },
];

/** A session on each of these days, asking these skills in its reviews and practice. */
const sessionsOn = (asked: Record<number, string[]>) =>
  Object.entries(asked).map(([day, practiceSkillIds]) => ({
    day: ruleDay(Number(day)),
    practiceSkillIds,
  }));

describe("R42 a finished lesson comes back when its end screen said", () => {
  it("passes when the promised day's session reviews a skill the lesson trained", () => {
    const context = ruleContext({
      after: plan,
      finishedLessons: finished,
      sessions: sessionsOn({ 0: [], 1: ["research"], 2: ["run-a-test"], 3: ["research"] }),
      today: ruleDay(3),
    });

    expect(checkFinishedLessonsComeBack(context)).toStrictEqual([]);
  });

  it("passes when a full day holds it to the next session, by the plan's skill", () => {
    const context = ruleContext({
      after: plan,
      finishedLessons: finished,
      sessions: sessionsOn({ 2: ["research"], 4: ["usability"] }),
      today: ruleDay(4),
    });

    expect(checkFinishedLessonsComeBack(context)).toStrictEqual([]);
  });

  it("waits for the second session on or after the promised day", () => {
    const context = ruleContext({
      after: plan,
      finishedLessons: finished,
      sessions: sessionsOn({ 1: ["research"], 2: ["research"] }),
      today: ruleDay(2),
    });

    expect(checkFinishedLessonsComeBack(context)).toStrictEqual([]);
  });

  it("flags a lesson no session asked after the day it was finished (practice on other skills)", () => {
    const context = ruleContext({
      after: plan,
      finishedLessons: finished,
      sessions: sessionsOn({ 0: ["usability"], 1: ["research"], 2: ["research"], 5: ["research"] }),
      today: ruleDay(5),
    });

    expect(checkFinishedLessonsComeBack(context)).toStrictEqual([
      {
        details: { comesBackOn: "2026-10-14", day: "2026-10-12", lessonId: "usability-0" },
        message: "A finished lesson didn't come back by the day its end screen said.",
        rule: "R42",
      },
    ]);
  });

  it("passes a lesson of an area the learner took out, and one whose end screen promised no day", () => {
    const sessions = sessionsOn({ 2: ["research"], 3: ["research"] });

    const takenOut = ruleContext({
      after: { ...plan, settings: { ...plan.settings, skippedAreas: ["Usability"] } },
      finishedLessons: finished,
      sessions,
      today: ruleDay(3),
    });

    const unpromised = ruleContext({
      after: plan,
      finishedLessons: finished.map((lesson) => ({ ...lesson, comesBackOn: null })),
      sessions,
      today: ruleDay(3),
    });

    expect(checkFinishedLessonsComeBack(takenOut)).toStrictEqual([]);
    expect(checkFinishedLessonsComeBack(unpromised)).toStrictEqual([]);
  });
});
