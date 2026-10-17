import { describe, expect, it } from "vitest";
import { type RuleSyllabus, type RuleView } from "./rule-context";
import { ruleContext, ruleLesson, rulePlan, ruleSkill } from "./rule-fixtures";
import {
  checkCoverageTrue,
  checkNoEmDashes,
  checkNoPromises,
  checkRecommendedTimeCovers,
} from "./shown-rules";

const skills = [
  ruleSkill({ area: "Linguística", skillId: "texto", topics: ["Interpretação de texto"] }),
  ruleSkill({ area: "Linguística", skillId: "sintaxe", topics: ["Sintaxe"] }),
];

const after = rulePlan({ items: [ruleLesson({ day: 0, skillId: "texto" })], skills });

function syllabus(sintaxe: RuleSyllabus["subjects"][number]["topics"][number]): RuleSyllabus {
  return {
    subjects: [
      {
        areas: ["Linguística"],
        name: "Língua Portuguesa",
        topics: [
          { name: "Interpretação de texto", notPlannedReason: null, status: "toStudy" },
          sintaxe,
        ],
      },
    ],
  };
}

function view(feasibility: Partial<NonNullable<RuleView["feasibility"]>>): RuleView {
  return {
    feasibility: { coreFits: false, fits: false, ...feasibility },
    schedule: { dailyMinutes: 120 },
  };
}

describe("R25 what the plan says it covers is true", () => {
  it("passes when the syllabus and the plan agree", () => {
    const context = ruleContext({
      after,
      syllabus: syllabus({ name: "Sintaxe", notPlannedReason: "time", status: "notPlanned" }),
      view: view({ coreFits: false }),
    });

    expect(checkCoverageTrue(context)).toStrictEqual([]);
  });

  it("flags 'every topic fits' next to topics out for time (Rafaela)", () => {
    const context = ruleContext({
      after,
      syllabus: syllabus({ name: "Sintaxe", notPlannedReason: "time", status: "notPlanned" }),
      view: view({ coreFits: true }),
    });

    expect(checkCoverageTrue(context)).toMatchObject([{ details: { outForTime: 1 }, rule: "R25" }]);
  });

  it("flags a topic shown to study that has no lessons", () => {
    const context = ruleContext({
      after,
      syllabus: syllabus({ name: "Sintaxe", notPlannedReason: null, status: "toStudy" }),
    });

    expect(checkCoverageTrue(context)).toMatchObject([
      { details: { topic: "Sintaxe" }, rule: "R25" },
    ]);
  });

  // Missed days set aside the rest of a topic the learner had begun: it's in progress, and what's
  // left of it is out for time. That's true while none of its lessons is left to do.
  it("reads a topic begun, its rest set aside for time, as true only with nothing left to do", () => {
    const studied = ruleLesson({ day: 0, skillId: "sintaxe", status: "done" });
    const setAside = ruleLesson({ day: 1, skillId: "sintaxe", status: "skipped" });
    const sintaxe = { name: "Sintaxe", notPlannedReason: "time", status: "inProgress" } as const;

    const begun = ruleContext({
      after: rulePlan({ items: [...after.items, studied, setAside], skills }),
      syllabus: syllabus(sintaxe),
    });

    expect(checkCoverageTrue(begun)).toStrictEqual([]);

    const leftToDo = ruleContext({
      after: rulePlan({
        items: [...after.items, studied, ruleLesson({ day: 2, skillId: "sintaxe" })],
        skills,
      }),
      syllabus: syllabus(sintaxe),
    });

    expect(checkCoverageTrue(leftToDo)).toMatchObject([
      { details: { topic: "Sintaxe" }, rule: "R25" },
    ]);
  });
});

describe("R26 the recommended time covers the goal", () => {
  it("passes when the plan at the recommended time fits", () => {
    const context = ruleContext({
      after,
      timeToCover: { recommendedMinutes: 90 },
      view: view({ coreFits: true, fits: true }),
    });

    expect(checkRecommendedTimeCovers(context)).toStrictEqual([]);
  });

  it("flags a plan at the recommended time that doesn't fit", () => {
    const context = ruleContext({ after, timeToCover: { recommendedMinutes: 90 }, view: view({}) });
    expect(checkRecommendedTimeCovers(context)).toHaveLength(1);
  });

  it("reads nothing into a plan whose learner didn't ask for the time", () => {
    const context = ruleContext({ after, view: view({}) });
    expect(checkRecommendedTimeCovers(context)).toStrictEqual([]);
  });
});

describe("R27 no em dashes", () => {
  it("passes for our own text without them and quoted sources with them", () => {
    const shown = [
      { source: "card", text: "Você termina Civil em 19 de novembro." },
      { quoted: true, source: "item", text: "O SR. WAGNER — Senhor presidente" },
    ];

    expect(checkNoEmDashes(ruleContext({ after, shown }))).toStrictEqual([]);
  });

  it("flags an em dash in a lesson", () => {
    const shown = [{ source: "lesson", text: "A ética — base da advocacia" }];
    expect(checkNoEmDashes(ruleContext({ after, shown }))).toMatchObject([{ rule: "R27" }]);
  });
});

describe("R28 never promise a pass", () => {
  it("passes for honest preparation words", () => {
    const shown = [{ source: "reveal", text: "Seu preparo: 63%. Faltam 12 tópicos." }];
    expect(checkNoPromises(ruleContext({ after, shown }))).toStrictEqual([]);
  });

  it("flags a promised pass", () => {
    const shown = [
      { source: "buddy", text: "Com esse plano você vai passar na OAB!" },
      { source: "pricing", text: "Guaranteed to pass your exam" },
    ];

    expect(checkNoPromises(ruleContext({ after, shown }))).toHaveLength(2);
  });
});
