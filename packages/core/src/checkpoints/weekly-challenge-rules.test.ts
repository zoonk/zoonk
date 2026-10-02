import { describe, expect, it } from "vitest";
import { type ExamStructure } from "../library/exams/blueprint-contract";
import { isNetScored, toMockConditions } from "./weekly-challenge-rules";

const citation = { passage: "passage", sourceId: "source" };

const structure: ExamStructure = {
  formats: [],
  mock: {
    adaptive: false,
    citations: [citation],
    order: null,
    scoring: { description: "Wrong answers cancel right ones", method: "wrongCancelsRight" },
    sections: [{ day: 2, minutes: 150, name: "Science and Math", questions: 45 }],
    timeLimitMinutes: 150,
    totalQuestions: 45,
  },
  rules: [],
  subjects: [],
};

describe(toMockConditions, () => {
  it("says the planned mock's size, sections and time, and whether it's net scored", () => {
    expect(
      toMockConditions({
        plan: {
          day: 2,
          fullLength: false,
          minutes: 75,
          sections: [
            {
              itemIds: ["a", "b"],
              minutes: 75,
              name: "Science and Math",
              questions: 2,
              routing: null,
            },
          ],
        },
        structure,
      }),
    ).toStrictEqual({
      netScoring: true,
      questions: 2,
      sections: [{ minutes: 75, name: "Science and Math", questions: 2 }],
      timeLimitMinutes: 75,
    });
  });
});

describe(isNetScored, () => {
  it("scores net only when wrong answers cancel right ones", () => {
    expect(isNetScored(structure)).toBe(true);
    expect(isNetScored(null)).toBe(false);
  });
});
