import { describe, expect, it } from "vitest";
import { ONE_PICK_MIX } from "./mock-format-mix";
import { type MockCandidate, type MockPlan } from "./mock-plan";
import { getMockQuestionsShortfall } from "./mock-shortfall";

describe(getMockQuestionsShortfall, () => {
  it("requests enough fresh items for both routes", () => {
    const candidates: MockCandidate[] = Array.from({ length: 4 }, (_, index) => ({
      answered: false,
      area: null,
      difficulty: index,
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
});
