import { describe, expect, it } from "vitest";
import { checkRules } from "./check-rules";
import { ruleContext, ruleEventItem, ruleLesson, rulePlan, ruleSkill } from "./rule-fixtures";

const skills = [
  ruleSkill({ area: "Civil", skillId: "civil", topics: ["Contratos"] }),
  ruleSkill({ area: "Penal", skillId: "penal", topics: ["Crimes"] }),
];

describe(checkRules, () => {
  it("finds nothing in a step that keeps every rule", () => {
    const plan = rulePlan({
      items: [ruleLesson({ day: 0, skillId: "civil" }), ruleLesson({ day: 1, skillId: "penal" })],
      skills,
    });

    const context = ruleContext({
      after: plan,
      before: plan,
      shown: [{ source: "today", text: "Hoje: 2 aulas." }],
    });

    expect(checkRules(context)).toStrictEqual([]);
  });

  it("names every rule a step breaks", () => {
    const before = rulePlan({
      items: [ruleLesson({ day: 0, skillId: "civil" }), ruleLesson({ day: 1, skillId: "penal" })],
      settings: { weekdayMinutes: [0, 30, 30, 30, 30, 30, 30] },
      skills,
    });

    const after = rulePlan({
      items: [
        ruleLesson({ day: 1, skillId: "penal" }),
        ruleEventItem({ day: 6, kind: "checkpoint" }),
      ],
      settings: { weekdayMinutes: [0, 30, 30, 30, 30, 30, 30] },
      skills,
    });

    const context = ruleContext({
      after,
      before,
      shown: [{ source: "today", text: "Hoje — 1 aula." }],
    });

    expect(checkRules(context).map((violation) => violation.rule)).toStrictEqual([
      "R14",
      "R21",
      "R27",
      "R32",
    ]);
  });

  it("reads only the shared content rules when an account is deleted", () => {
    const plan = rulePlan({
      items: [ruleEventItem({ day: 6, kind: "checkpoint" })],
      settings: { weekdayMinutes: [0, 30, 30, 30, 30, 30, 30] },
      skills,
    });

    const context = ruleContext({
      after: plan,
      before: plan,
      event: { kind: "accountDeleted" },
      sharedContent: { after: new Map(), before: new Map([["lesson:1", "1"]]) },
    });

    expect(checkRules(context).map((violation) => violation.rule)).toStrictEqual(["R29"]);
  });
});
