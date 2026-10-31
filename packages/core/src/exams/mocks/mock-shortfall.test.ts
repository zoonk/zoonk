import { describe, expect, it } from "vitest";
import { type MockFormat, ONE_PICK_MIX } from "./mock-format-mix";
import { type MockCandidate, type MockPlan } from "./mock-plan";
import { getMockQuestionsShortfall } from "./mock-shortfall";

function numbers(sections: string[]): MockFormat {
  return {
    key: "numeric:fraction:",
    sections,
    share: 1,
    style: "numeric: Type a number",
    writer: {
      answerFormat: {
        entry: { kind: "fraction", places: null },
        format: "numeric",
        options: null,
        select: null,
      },
      kind: "item",
    },
  };
}

describe(getMockQuestionsShortfall, () => {
  it("requests enough fresh items for both routes", () => {
    const candidates: MockCandidate[] = Array.from({ length: 4 }, (_, index) => ({
      answered: false,
      area: null,
      difficulty: index,
      itemFormat: "trueFalse" as const,
      itemId: String(index),
      skillId: "skill",
    }));

    const plan: MockPlan = {
      day: null,
      formatsWanted: { choice: 8 },
      fullLength: true,
      minutes: 10,
      reused: 0,
      sections: [
        {
          essays: [],
          itemIds: [],
          minutes: 10,
          name: null,
          questions: 2,
          routing: { easier: ["0", "1"], harder: ["2", "3"] },
        },
      ],
      written: [],
    };

    expect(
      getMockQuestionsShortfall({
        candidates,
        mix: ONE_PICK_MIX,
        option: { questions: 4 },
        plan,
        skills: [{ area: null, id: "skill" }],
      }),
    ).toStrictEqual([
      { format: ONE_PICK_MIX[0], questionsPerSkill: 4, skillIds: ["skill"], target: 8 },
    ]);
  });

  it("writes numbers for the skills of the parts that ask them, and untied numbers only where some exist", () => {
    const plan: MockPlan = {
      day: null,
      formatsWanted: { "numeric:fraction:": 4 },
      fullLength: true,
      minutes: 10,
      reused: 0,
      sections: [],
      written: [],
    };

    const skills = [
      { area: "Verbal Reasoning", id: "words" },
      { area: "Quantitative Reasoning", id: "ratios" },
      { area: "Quantitative Reasoning", id: "charts", isQuantitative: false },
    ];

    const shortfall = (format: MockFormat) =>
      getMockQuestionsShortfall({
        candidates: [],
        mix: [format],
        option: { questions: 4 },
        plan,
        skills,
      }).flatMap((write) => write.skillIds);

    expect(shortfall(numbers(["Quantitative Reasoning"]))).toStrictEqual(["ratios"]);
    expect(shortfall(numbers([]))).toStrictEqual([]);
  });
});
