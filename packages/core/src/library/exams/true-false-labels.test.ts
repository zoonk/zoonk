import { describe, expect, it } from "vitest";
import { type ExamStructure } from "./blueprint-contract";
import { getTrueFalseLabels } from "./true-false-labels";

const CITATION = { passage: "Conforme o edital.", sourceId: "notice" };

function structureScoredBy(
  method: NonNullable<ExamStructure["mock"]>["scoring"]["method"],
): ExamStructure {
  return {
    formats: [{ citation: CITATION, description: "Itens", kind: "trueFalse", options: null }],
    mock: {
      adaptive: false,
      citations: [CITATION],
      order: null,
      scoring: { description: "Conforme o edital.", method },
      sections: [],
      timeLimitMinutes: 180,
      totalQuestions: 120,
    },
    rules: [],
    subjects: [],
  };
}

describe(getTrueFalseLabels, () => {
  it("judges statements right or wrong when a wrong answer cancels a right one, as in Cebraspe", () => {
    expect(getTrueFalseLabels(structureScoredBy("wrongCancelsRight"))).toBe("rightWrong");
  });

  it("keeps true or false for exams scored another way, like ENEM's item response theory", () => {
    expect(getTrueFalseLabels(structureScoredBy("itemResponseTheory"))).toBe("trueFalse");
    expect(getTrueFalseLabels(structureScoredBy("raw"))).toBe("trueFalse");
  });

  it("keeps true or false when the exam's scoring isn't known or the goal has no exam", () => {
    expect(getTrueFalseLabels({ ...structureScoredBy("raw"), mock: null })).toBe("trueFalse");
    expect(getTrueFalseLabels(null)).toBe("trueFalse");
  });
});
