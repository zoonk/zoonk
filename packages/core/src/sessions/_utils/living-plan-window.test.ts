import { describe, expect, it } from "vitest";
import { recordLivingPlanAnswers } from "./living-plan-window";

const FIRST = new Date("2026-11-20T12:00:00Z");
const SECOND = new Date("2026-11-21T12:00:00Z");

function answers(correct: number, total: number) {
  return Array.from({ length: total }, (_, index) => ({
    isCorrect: index < correct,
    skillId: "topic",
  }));
}

describe(recordLivingPlanAnswers, () => {
  it("closes disjoint windows and counts a second easy window only after 40 answers", () => {
    const first = recordLivingPlanAnswers({ answers: answers(17, 20), at: FIRST, stored: null });

    const partial = recordLivingPlanAnswers({
      answers: answers(16, 19),
      at: SECOND,
      stored: first,
    });

    const second = recordLivingPlanAnswers({ answers: answers(1, 1), at: SECOND, stored: partial });

    expect(first.closed).toMatchObject({ result: "easy", streak: 1 });
    expect(partial.closed).toStrictEqual(first.closed);

    expect(second.closed).toStrictEqual({
      at: SECOND.toISOString(),
      missedSkillIds: [],
      result: "easy",
      streak: 2,
    });

    expect(second.total).toBe(0);
  });

  it("keeps only missed topics from a hard window and breaks an easy streak", () => {
    const first = recordLivingPlanAnswers({ answers: answers(20, 20), at: FIRST, stored: null });
    const hard = recordLivingPlanAnswers({ answers: answers(9, 20), at: SECOND, stored: first });
    const neutral = recordLivingPlanAnswers({ answers: answers(10, 20), at: SECOND, stored: hard });

    expect(hard.closed).toMatchObject({ missedSkillIds: ["topic"], result: "hard", streak: 1 });
    expect(neutral.closed).toMatchObject({ missedSkillIds: [], result: "steady", streak: 1 });
  });
});
