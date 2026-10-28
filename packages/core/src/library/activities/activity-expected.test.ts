import {
  activityContentFixtures,
  engineModeFixtures,
} from "@zoonk/testing/fixtures/activity-contents";
import { describe, expect, it } from "vitest";
import { getActivityExpected } from "./activity-expected";
import { activityExpectedSchema } from "./activity-expected-answer";
import { activityContentSchema, getActivityTemplate } from "./activity-templates";

const numberLine = {
  check: {
    answer: 5,
    explanation: "Three degrees to zero, five more above it.",
    kind: "numeric",
    question: "Where does it land?",
    tolerance: { kind: "absolute", value: 0 },
  },
  fields: {
    label: "Temperature",
    max: 7,
    min: -5,
    moves: [{ by: 3 }, { by: 5 }],
    start: -3,
    step: 1,
  },
  prompt: "Drag the dot to noon's temperature.",
  template: "numberLine",
};

describe(getActivityExpected, () => {
  it("uses the check's answer for numeric checks", () => {
    expect(getActivityExpected(activityContentSchema.parse(numberLine))).toStrictEqual({
      kind: "numeric",
      value: 5,
    });
  });

  it("uses the correct option for choice checks", () => {
    const content = activityContentSchema.parse({
      ...numberLine,
      check: {
        kind: "choice",
        options: [
          { id: "a", isCorrect: false, reason: "It crosses zero.", text: "11" },
          { id: "b", isCorrect: true, reason: "Three to zero, then five.", text: "5" },
        ],
        question: "Where does it land?",
      },
    });

    expect(getActivityExpected(content)).toStrictEqual({ kind: "choice", optionId: "b" });
  });

  it("computes the end state for interaction checks from the fields", () => {
    const content = activityContentSchema.parse({
      check: { explanation: "Tax is charged on the sale price.", kind: "interaction" },
      fields: {
        problem: "A $60 jacket is 25% off. With 8% tax, what do you pay?",
        steps: [
          {
            choices: [
              {
                id: "a",
                isCorrect: true,
                reason: "The discount comes first.",
                text: "Take 25% off",
              },
              { id: "b", isCorrect: false, reason: "Tax comes after.", text: "Add the tax" },
            ],
            expression: "60 * 0.75",
            id: "discount",
            math: "60 − 15 = 45",
            prompt: "What comes first?",
            value: 45,
          },
          {
            choices: [
              { id: "a", isCorrect: false, reason: "That's before the discount.", text: "$60" },
              { id: "b", isCorrect: true, reason: "You pay tax on what you pay.", text: "$45" },
            ],
            expression: "45 * 0.08",
            id: "tax",
            math: "8% of 45 = 3.60",
            prompt: "8% of which price?",
            value: 3.6,
          },
        ],
      },
      prompt: "Solve it one step at a time.",
      template: "stepSolver",
    });

    expect(getActivityExpected(content)).toStrictEqual({
      answer: { kind: "assignment", pairs: { discount: "a", tax: "b" } },
      kind: "interaction",
    });
  });

  // Native clients decode the step check's `expected` as closed objects: a key the contract
  // doesn't list fails the whole answer there.
  it("computes every template's end state with only the keys the contract publishes", () => {
    const contents = [
      ...Object.values(activityContentFixtures),
      ...Object.values(engineModeFixtures).flatMap((modes): unknown[] => Object.values(modes)),
    ].map((content) => activityContentSchema.parse(content));

    const ends = contents.flatMap(
      (content) => getActivityTemplate(content.template)?.computeExpected(content.fields) ?? [],
    );

    expect(new Set(ends.map((end) => end.kind)).size).toBeGreaterThan(10);

    for (const answer of ends) {
      const expected = { answer, kind: "interaction" };
      expect(activityExpectedSchema.parse(expected)).toStrictEqual(expected);
    }
  });
});
