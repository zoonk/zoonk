import { describe, expect, it } from "vitest";
import { checkPrerequisitesFirst, checkWrittenTestsKept } from "./keep-rules";
import { ruleContext, ruleDay, ruleLesson, rulePlan, ruleSkill } from "./rule-fixtures";

describe("R12 an exam's written tests are always in", () => {
  const skills = [
    ruleSkill({ area: "Redação", outcome: true, skillId: "redacao" }),
    ruleSkill({ area: "Matemática", skillId: "funcoes" }),
  ];

  const exam = (items: ReturnType<typeof ruleLesson>[]) =>
    rulePlan({ goal: { kind: "exam", targetDate: ruleDay(60) }, items, skills });

  const event = { kind: "planCreated" } as const;

  it("passes when the essay starts in the first week", () => {
    const after = exam([
      ruleLesson({ day: 0, skillId: "funcoes" }),
      ruleLesson({ day: 3, skillId: "redacao" }),
    ]);

    expect(checkWrittenTestsKept(ruleContext({ after, event }))).toStrictEqual([]);
  });

  it("flags an essay that waits past the first week, and one cut", () => {
    const late = exam([
      ruleLesson({ day: 0, skillId: "funcoes" }),
      ruleLesson({ day: 9, skillId: "redacao" }),
    ]);

    const cut = exam([ruleLesson({ day: 0, skillId: "funcoes" })]);

    expect(checkWrittenTestsKept(ruleContext({ after: late, event }))).toHaveLength(1);

    expect(checkWrittenTestsKept(ruleContext({ after: cut }))).toMatchObject([
      { details: { area: "Redação" }, rule: "R12" },
    ]);
  });
});

describe("R16 what a skill builds on comes first", () => {
  const skills = [ruleSkill({ skillId: "base" }), ruleSkill({ skillId: "top" })];
  const prerequisites = new Map([["top", ["base"]]]);

  it("passes when the base comes first", () => {
    const after = rulePlan({
      items: [ruleLesson({ day: 0, skillId: "base" }), ruleLesson({ day: 1, skillId: "top" })],
      prerequisites,
      skills,
    });

    expect(checkPrerequisitesFirst(ruleContext({ after }))).toStrictEqual([]);
  });

  it("flags a skill due before its base", () => {
    const after = rulePlan({
      items: [ruleLesson({ day: 0, skillId: "top" }), ruleLesson({ day: 2, skillId: "base" })],
      prerequisites,
      skills,
    });

    expect(checkPrerequisitesFirst(ruleContext({ after }))).toMatchObject([
      { details: { base: "base", skill: "top" }, rule: "R16" },
    ]);
  });

  it("reads a base the learner studied in a finished lesson of another skill as begun", () => {
    const finished = ruleLesson({ day: 0, lessonId: "rent", skillId: "other", status: "done" });

    const after = rulePlan({
      items: [
        finished,
        ruleLesson({ day: 1, skillId: "top" }),
        ruleLesson({ day: 2, skillId: "base" }),
      ],
      prerequisites,
      skills: [...skills, ruleSkill({ skillId: "other" })],
      taughtBy: new Map([["rent", ["other", "base"]]]),
    });

    expect(checkPrerequisitesFirst(ruleContext({ after }))).toStrictEqual([]);
  });
});
