import { describe, expect, it } from "vitest";
import { ruleChangeEvent, ruleContext, ruleLesson, rulePlan, ruleSkill } from "./rule-fixtures";
import { checkSteeringKeepsToday } from "./steering-rules";

const skills = [
  ruleSkill({ area: "Civil", skillId: "civil" }),
  ruleSkill({ area: "Filosofia", skillId: "filosofia" }),
  ruleSkill({ area: "Penal", skillId: "penal" }),
];

/** A plan of these lessons; a skill's n-th lesson is the same lesson in every plan. */
function plan(items: { day: number; skillId: string }[]) {
  return rulePlan({
    items: items.map((item, index) => {
      const nth = items.slice(0, index + 1).filter((other) => other.skillId === item.skillId);
      return ruleLesson({ ...item, lessonId: `${item.skillId}-${nth.length}` });
    }),
    skills,
  });
}

const focusCivil = ruleChangeEvent({ areas: ["Civil"], kind: "focusAreas" });

const lessCivil = ruleChangeEvent({ areas: ["Civil"], kind: "reduceAreas" });

const lessCivMoreFil = ruleChangeEvent(
  { areas: ["Filosofia"], kind: "focusAreas" },
  { areas: ["Civil"], kind: "reduceAreas" },
);

describe("R4 a change of focus keeps today as the learner saw it", () => {
  it("passes when only the reduced area's lesson leaves and the focused one comes in", () => {
    const before = plan([
      { day: 0, skillId: "penal" },
      { day: 0, skillId: "civil" },
    ]);

    const after = plan([
      { day: 0, skillId: "penal" },
      { day: 0, skillId: "filosofia" },
    ]);

    expect(
      checkSteeringKeepsToday(
        ruleContext({ after, before, event: lessCivMoreFil, todayShown: true }),
      ),
    ).toStrictEqual([]);
  });

  it("flags an unasked subject that comes into today (Sofia's Processo Penal)", () => {
    const before = plan([
      { day: 0, skillId: "civil" },
      { day: 1, skillId: "penal" },
    ]);

    const after = plan([
      { day: 0, skillId: "penal" },
      { day: 0, skillId: "civil" },
    ]);

    expect(
      checkSteeringKeepsToday(ruleContext({ after, before, event: focusCivil, todayShown: true })),
    ).toMatchObject([{ details: { problem: "came in from Penal" }, rule: "R4" }]);
  });

  it("flags a focused lesson put before today's lessons", () => {
    const before = plan([
      { day: 0, skillId: "penal" },
      { day: 1, skillId: "civil" },
    ]);

    const after = plan([
      { day: 0, skillId: "civil" },
      { day: 0, skillId: "penal" },
    ]);

    expect(
      checkSteeringKeepsToday(ruleContext({ after, before, event: focusCivil, todayShown: true })),
    ).toMatchObject([{ details: { problem: "came in before today's lessons" }, rule: "R4" }]);
  });

  it("passes when, with less alone, the next lesson takes the freed time after today's (OAB seed 1006)", () => {
    const before = plan([
      { day: 0, skillId: "penal" },
      { day: 0, skillId: "civil" },
      { day: 1, skillId: "filosofia" },
    ]);

    const after = plan([
      { day: 0, skillId: "penal" },
      { day: 0, skillId: "filosofia" },
      { day: 1, skillId: "civil" },
    ]);

    expect(
      checkSteeringKeepsToday(ruleContext({ after, before, event: lessCivil, todayShown: true })),
    ).toStrictEqual([]);
  });

  it("flags, with less alone, a lesson put before today's and one of the reduced area coming in", () => {
    const before = plan([
      { day: 0, skillId: "penal" },
      { day: 1, skillId: "filosofia" },
      { day: 1, skillId: "civil" },
    ]);

    const after = plan([
      { day: 0, skillId: "filosofia" },
      { day: 0, skillId: "penal" },
      { day: 0, skillId: "civil" },
    ]);

    expect(
      checkSteeringKeepsToday(ruleContext({ after, before, event: lessCivil, todayShown: true })),
    ).toMatchObject([
      { details: { problem: "came in from Civil" }, rule: "R4" },
      { details: { problem: "came in before today's lessons" }, rule: "R4" },
    ]);
  });
});
