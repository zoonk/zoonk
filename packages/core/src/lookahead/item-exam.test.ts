import { describe, expect, it } from "vitest";
import { examFormat } from "../library/exams/_test-utils/exam-formats";
import { getGoalItemExam } from "./item-exam";

describe(getGoalItemExam, () => {
  const goal = {
    details: { noticeFormats: [examFormat("multipleChoice")] },
    examBlueprint: null,
    kind: "exam" as const,
    title: "TRT-4 with Maria",
  };

  it("names a notice's exam as onboarding understood it, never by the title the learner gave the goal", () => {
    const named = getGoalItemExam({
      ...goal,
      details: { ...goal.details, examName: "TRT-4", targetPosition: "Analyst like Maria" },
    });

    expect(named.exam?.name).toBe("TRT-4");
    expect(getGoalItemExam(goal).exam).toMatchObject({ name: null, style: expect.any(String) });
  });
});
