import { describe, expect, it } from "vitest";
import {
  checkNoRegeneration,
  checkSharedContentKept,
  checkSharedPromptsImpersonal,
} from "./content-rules";
import { ruleContext, rulePlan } from "./rule-fixtures";

const after = rulePlan({ skills: [] });

const library = new Map([
  ["lessons:1", "2026-10-09T10:00:00.000Z"],
  ["skills:2", "2026-10-09T10:00:00.000Z"],
]);

describe("R29 deleting an account keeps shared content", () => {
  const event = { kind: "accountDeleted" } as const;

  it("passes when every shared row is still there", () => {
    const sharedContent = { after: library, before: library };
    expect(checkSharedContentKept(ruleContext({ after, event, sharedContent }))).toStrictEqual([]);
  });

  it("flags a shared lesson the deletion removed", () => {
    const sharedContent = { after: new Map([["skills:2", "v"]]), before: library };

    expect(checkSharedContentKept(ruleContext({ after, event, sharedContent }))).toMatchObject([
      { details: { missing: ["lessons:1"] }, rule: "R29" },
    ]);
  });
});

describe("R30 shared prompts never carry the learner's own words", () => {
  const learner = { personalTexts: ["Quero passar em Medicina na UFMG", "Lucas", "Pelotas"] };

  it("passes when a shared graph is written from the exam's name only", () => {
    const generations = [{ input: "GOAL: ENEM", shared: true, task: "skill-graph" }];

    expect(
      checkSharedPromptsImpersonal(ruleContext({ after, generations, learner })),
    ).toStrictEqual([]);
  });

  it("flags the learner's city in a shared task, not in a private one", () => {
    const generations = [
      { input: "Exemplos para quem mora em pelotas", shared: true, task: "lesson-writer" },
      { input: "Lucas mora em Pelotas", shared: false, task: "goal-tutor" },
    ];

    expect(
      checkSharedPromptsImpersonal(ruleContext({ after, generations, learner })),
    ).toMatchObject([{ details: { leaked: ["pelotas"], task: "lesson-writer" }, rule: "R30" }]);
  });
});

describe("R31 a prompt change never rewrites shared content", () => {
  const event = { kind: "promptChanged" } as const;

  it("passes when the Library is reused as it was", () => {
    const sharedContent = { after: library, before: library };
    expect(checkNoRegeneration(ruleContext({ after, event, sharedContent }))).toStrictEqual([]);
  });

  it("flags a regenerated skill graph", () => {
    const sharedContent = { after: library, before: library };
    const generations = [{ input: "GOAL: ENEM", shared: true, task: "skill-graph" }];

    expect(
      checkNoRegeneration(ruleContext({ after, event, generations, sharedContent })),
    ).toMatchObject([{ details: { generated: ["skill-graph"] }, rule: "R31" }]);
  });
});
